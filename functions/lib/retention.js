"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.hardDeleteExpiredWorkspaces = exports.purgeExpiredAuditSecurityLogs = exports.purgeExpiredDatabaseBackups = exports.purgeExpiredTimeClockArchives = exports.archiveExpiredTimeClockData = exports.purgeExpiredAiUploads = exports.purgeTransientOperationalData = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const node_crypto_1 = require("node:crypto");
const node_zlib_1 = require("node:zlib");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const storage = (0, storage_1.getStorage)();
const REGION = "us-central1";
const TIME_ZONE = "America/Chicago";
const PAGE_SIZE = 250;
const MAX_DOCS_PER_RULE_PER_RUN = 10000;
const MAX_STORAGE_OBJECTS_PER_RUN = 20000;
const WORK_BUDGET_MS = 7 * 60 * 1000;
const LOCK_LEASE_MS = 12 * 60 * 1000;
const ARCHIVE_PREFIX = "archive/time_clock/";
const RETENTION_ARCHIVE_BUCKET = String(process.env.RETENTION_ARCHIVE_BUCKET || "").trim();
const AI_UPLOADS_BUCKET = String(process.env.AI_UPLOADS_BUCKET || "").trim();
// 86 Chaos legal retention policy, aligned to the July 9, 2026 legal packet:
// - Transient operational data: 30 days.
// - Raw AI prompts/uploads/scans: 30 days. Reviewed/parsed business records stay in-app.
// - Deleted workspace data: 30-day recovery window, then hard delete.
// - Database backups: 30-day rolling retention.
// - Audit/security logs: 1 year.
// - Workforce/time-clock/geofence logs: archive after 1 year and retain until 3 years from event.
// - Active core data, including recipes and inventory, remains while the account is active.
const RETENTION_POLICY = Object.freeze({
    transientDays: 30,
    rawAiDays: 30,
    deletedWorkspaceDays: 30,
    backupDays: 30,
    auditSecurityDays: 365,
    workforceArchiveAfterDays: 365,
    workforceDeleteAfterYears: 3,
});
const TENANT_COLLECTIONS = [
    "events",
    "messages",
    "shiftSwaps",
    "tasks",
    "timePunches",
    "time_punches",
    "locationLogs",
    "location_logs",
    "tempLogs",
    "wasteLogs",
    "maintenanceLogs",
    "offlineWriteReceipts",
    "prepItems",
    "prep_lists",
    "86_alerts",
    "prepCategories",
    "lineCheckItems",
    "recipes",
    "inventoryItems",
    "vendors",
    "orders",
    "invoices",
    "shifts",
    "timeOffRequests",
    "roles",
    "pmSchedules",
    "sales",
    "menuDependencies",
    "menuIntelligenceScans",
    "personalReminders",
    "scheduleTemplates",
    "scheduleCoverageTargets",
    "auditLogs",
    "crashReports",
    "accountDeletionRequests",
    "workspaceMembers",
    "presenceSessions",
    "livePresence",
    "securityAlerts",
];
const TRANSIENT_RULES = [
    // Server-only request guards. The API writes short-lived expiry fields; keep
    // a 30-day forensic buffer, then remove them so cost controls stay bounded.
    { collection: "aiRequestLocks", field: "expiresAt", cutoffKind: "timestamp" },
    { collection: "apiRateLimits", field: "expiresAt", cutoffKind: "iso" },
    // Current 86 Chaos schema.
    {
        collection: "prepItems",
        field: "date",
        cutoffKind: "date-key",
        skip: (data) => data.isMaster === true || data.date === "MASTER",
    },
    {
        collection: "events",
        field: "date",
        cutoffKind: "iso",
        equalField: "messageCategory",
        equalValue: "86 Alert",
    },
    // Requested/future snake_case schema support.
    { collection: "prep_lists", field: "created_at", cutoffKind: "timestamp" },
    { collection: "86_alerts", field: "created_at", cutoffKind: "timestamp" },
];
const AI_PROMPT_RULES = [
    // Raw/diagnostic AI request records. These are intentionally separate from
    // reviewed invoice/menu business records, which remain as parsed operational
    // data after manager review.
    { collection: "aiPrompts", field: "createdAt", cutoffKind: "timestamp" },
    { collection: "aiFeatureLogs", field: "createdAt", cutoffKind: "timestamp" },
    { collection: "aiRequestLogs", field: "createdAt", cutoffKind: "timestamp" },
    { collection: "aiScanRawRequests", field: "createdAt", cutoffKind: "timestamp" },
    { collection: "aiUploads", field: "createdAt", cutoffKind: "timestamp" },
];
const AUDIT_SECURITY_RULES = [
    { collection: "auditLogs", field: "timestamp", cutoffKind: "iso" },
    { collection: "securityAlerts", field: "createdAt", cutoffKind: "iso" },
    { collection: "securityEvents", field: "createdAt", cutoffKind: "timestamp" },
    { collection: "suspiciousActivity", field: "createdAt", cutoffKind: "timestamp" },
    { collection: "crashReports", field: "createdAt", cutoffKind: "iso" },
    { collection: "presenceSessions", field: "lastSeenAt", cutoffKind: "timestamp" },
    { collection: "livePresence", field: "lastSeenAt", cutoffKind: "timestamp" },
];
const ARCHIVE_RULES = [
    // Current 86 Chaos schema. Geofence information is embedded in each punch.
    { collection: "timePunches", field: "clockInTime", cutoffKind: "iso" },
    // Future/alternate collection support.
    { collection: "time_punches", field: "created_at", cutoffKind: "timestamp" },
    { collection: "locationLogs", field: "createdAt", cutoffKind: "iso" },
    { collection: "location_logs", field: "created_at", cutoffKind: "timestamp" },
];
class JobAlreadyRunningError extends Error {
}
function cutoffTimestamp(days) {
    return firestore_1.Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);
}
function cutoffIso(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
function cutoffDateKey(days) {
    return cutoffIso(days).slice(0, 10);
}
function cutoffFor(kind, days) {
    if (kind === "timestamp")
        return cutoffTimestamp(days);
    if (kind === "date-key")
        return cutoffDateKey(days);
    return cutoffIso(days);
}
function outOfTime(startedAt) {
    return Date.now() - startedAt >= WORK_BUDGET_MS;
}
function chunk(items, size) {
    const groups = [];
    for (let index = 0; index < items.length; index += size) {
        groups.push(items.slice(index, index + size));
    }
    return groups;
}
async function withJobLock(jobName, work) {
    const lockRef = db.collection("_retentionJobLocks").doc(jobName);
    const token = (0, node_crypto_1.randomUUID)();
    try {
        await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(lockRef);
            const leaseUntil = snapshot.get("leaseUntil");
            if (leaseUntil instanceof firestore_1.Timestamp && leaseUntil.toMillis() > Date.now()) {
                throw new JobAlreadyRunningError(`${jobName} is already running.`);
            }
            transaction.set(lockRef, {
                token,
                leaseUntil: firestore_1.Timestamp.fromMillis(Date.now() + LOCK_LEASE_MS),
                startedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
    }
    catch (error) {
        if (error instanceof JobAlreadyRunningError) {
            functions.logger.warn(error.message);
            return null;
        }
        throw error;
    }
    try {
        return await work();
    }
    finally {
        await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(lockRef);
            if (snapshot.get("token") !== token)
                return;
            transaction.set(lockRef, {
                leaseUntil: firestore_1.Timestamp.fromMillis(0),
                finishedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        }).catch((error) => functions.logger.error("Could not release retention lock.", { jobName, error }));
    }
}
async function deleteDocuments(documents) {
    if (!documents.length)
        return { deleted: 0, failed: 0 };
    const writer = db.bulkWriter();
    const operations = documents.map((document) => document.updateTime
        ? writer.delete(document.ref, { lastUpdateTime: document.updateTime })
        : writer.delete(document.ref));
    const closePromise = writer.close();
    const settled = await Promise.allSettled(operations);
    await closePromise;
    let deleted = 0;
    let failed = 0;
    settled.forEach((result, index) => {
        if (result.status === "fulfilled") {
            deleted += 1;
        }
        else {
            failed += 1;
            functions.logger.error("Retention document delete failed.", {
                path: documents[index].ref.path,
                reason: String(result.reason),
            });
        }
    });
    return { deleted, failed };
}
async function purgeRule(rule, days, startedAt) {
    let cursor;
    let scanned = 0;
    let eligible = 0;
    let deleted = 0;
    let failed = 0;
    const cutoff = cutoffFor(rule.cutoffKind, days);
    while (scanned < MAX_DOCS_PER_RULE_PER_RUN && !outOfTime(startedAt)) {
        let query = db.collection(rule.collection);
        if (rule.equalField)
            query = query.where(rule.equalField, "==", rule.equalValue);
        query = query
            .where(rule.field, "<", cutoff)
            .orderBy(rule.field, "asc")
            .limit(Math.min(PAGE_SIZE, MAX_DOCS_PER_RULE_PER_RUN - scanned));
        if (cursor)
            query = query.startAfter(cursor);
        const snapshot = await query.get();
        if (snapshot.empty)
            break;
        const documents = rule.skip
            ? snapshot.docs.filter((document) => !rule.skip?.(document.data()))
            : snapshot.docs;
        const result = await deleteDocuments(documents);
        scanned += snapshot.size;
        eligible += documents.length;
        deleted += result.deleted;
        failed += result.failed;
        cursor = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < PAGE_SIZE)
            break;
    }
    return { scanned, eligible, deleted, failed };
}
function archiveBucket() {
    if (!RETENTION_ARCHIVE_BUCKET) {
        throw new Error("RETENTION_ARCHIVE_BUCKET is missing. Create the archive bucket, set the variable, and redeploy functions. No time-clock documents were deleted.");
    }
    return storage.bucket(RETENTION_ARCHIVE_BUCKET);
}
function aiBucket() {
    return AI_UPLOADS_BUCKET ? storage.bucket(AI_UPLOADS_BUCKET) : storage.bucket();
}
function serialize(value) {
    if (value instanceof firestore_1.Timestamp)
        return { __type: "timestamp", value: value.toDate().toISOString() };
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        return { __type: "bytes", base64: Buffer.from(value).toString("base64") };
    }
    if (Array.isArray(value))
        return value.map(serialize);
    if (value && typeof value === "object") {
        const possibleRef = value;
        if (typeof possibleRef.path === "string" && typeof possibleRef.get === "function") {
            return { __type: "document_reference", path: possibleRef.path };
        }
        const output = {};
        Object.keys(value).sort().forEach((key) => {
            output[key] = serialize(value[key]);
        });
        return output;
    }
    return value;
}
function addUtcCalendarYears(date, years) {
    const targetYear = date.getUTCFullYear() + years;
    const month = date.getUTCMonth();
    const lastDay = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(targetYear, month, Math.min(date.getUTCDate(), lastDay), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}
function documentEventDate(document, field) {
    const value = document.get(field);
    if (value instanceof firestore_1.Timestamp)
        return value.toDate();
    const parsed = new Date(String(value || ""));
    if (!Number.isFinite(parsed.getTime())) {
        throw new Error(`${document.ref.path} has an invalid archive date in ${field}.`);
    }
    return parsed;
}
async function uploadArchiveShard(rule, documents) {
    const records = documents
        .map((document) => ({
        archiveSchemaVersion: 1,
        sourceCollection: rule.collection,
        sourcePath: document.ref.path,
        sourceUpdateTime: document.updateTime?.toDate().toISOString() || null,
        eventTime: documentEventDate(document, rule.field).toISOString(),
        data: serialize(document.data()),
    }))
        .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
    const ndjson = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
    const sha256 = (0, node_crypto_1.createHash)("sha256").update(ndjson).digest("hex");
    const compressed = (0, node_zlib_1.gzipSync)(Buffer.from(ndjson, "utf8"), { level: 9 });
    const newestEvent = new Date(Math.max(...records.map((record) => new Date(record.eventTime).getTime())));
    const deleteAfter = addUtcCalendarYears(newestEvent, RETENTION_POLICY.workforceDeleteAfterYears);
    const eventDay = records[0].eventTime.slice(0, 10);
    const objectName = `${ARCHIVE_PREFIX}${rule.collection}/event_date=${eventDay}/${sha256.slice(0, 32)}.ndjson.gz`;
    const file = archiveBucket().file(objectName);
    try {
        await file.save(compressed, {
            resumable: false,
            validation: "crc32c",
            preconditionOpts: { ifGenerationMatch: 0 },
            metadata: {
                contentType: "application/x-ndjson",
                contentEncoding: "gzip",
                cacheControl: "no-store",
                customTime: newestEvent.toISOString(),
                metadata: {
                    archiveSchemaVersion: "1",
                    sourceCollection: rule.collection,
                    recordCount: String(records.length),
                    contentSha256: sha256,
                    deleteAfter: deleteAfter.toISOString(),
                },
            },
        });
    }
    catch (error) {
        if (Number(error.code) !== 412)
            throw error;
    }
    const [metadata] = await file.getMetadata();
    if (metadata.metadata?.contentSha256 !== sha256 ||
        metadata.metadata?.recordCount !== String(records.length)) {
        throw new Error(`Archive verification failed for ${objectName}. Source documents were not deleted.`);
    }
    return objectName;
}
async function archiveRule(rule, days, startedAt) {
    let cursor;
    let scanned = 0;
    let archived = 0;
    let deleted = 0;
    let failed = 0;
    const cutoff = cutoffFor(rule.cutoffKind, days);
    while (scanned < MAX_DOCS_PER_RULE_PER_RUN && !outOfTime(startedAt)) {
        let query = db.collection(rule.collection)
            .where(rule.field, "<", cutoff)
            .orderBy(rule.field, "asc")
            .limit(Math.min(PAGE_SIZE, MAX_DOCS_PER_RULE_PER_RUN - scanned));
        if (cursor)
            query = query.startAfter(cursor);
        const snapshot = await query.get();
        if (snapshot.empty)
            break;
        const objectName = await uploadArchiveShard(rule, snapshot.docs);
        const result = await deleteDocuments(snapshot.docs);
        scanned += snapshot.size;
        archived += snapshot.size;
        deleted += result.deleted;
        failed += result.failed;
        cursor = snapshot.docs[snapshot.docs.length - 1];
        functions.logger.info("Archived time-clock shard.", {
            collection: rule.collection,
            objectName,
            archived: snapshot.size,
            sourceDeleted: result.deleted,
            sourceDeleteFailed: result.failed,
        });
        if (snapshot.size < PAGE_SIZE)
            break;
    }
    return { scanned, archived, deleted, failed };
}
async function deleteStoragePrefix(bucketName, prefix, cutoffMs, startedAt) {
    const bucket = storage.bucket(bucketName);
    let pageToken;
    let scanned = 0;
    let deleted = 0;
    let failed = 0;
    do {
        const [filesRaw, nextQuery] = await bucket.getFiles({
            prefix,
            autoPaginate: false,
            maxResults: Math.min(1000, MAX_STORAGE_OBJECTS_PER_RUN - scanned),
            pageToken,
        });
        const files = filesRaw;
        scanned += files.length;
        const expired = files.filter((file) => {
            const created = Date.parse(String(file.metadata.timeCreated || ""));
            return Number.isFinite(created) && created < cutoffMs;
        });
        for (const group of chunk(expired, 25)) {
            const results = await Promise.allSettled(group.map((file) => file.delete({ ignoreNotFound: true })));
            results.forEach((result, index) => {
                if (result.status === "fulfilled")
                    deleted += 1;
                else {
                    failed += 1;
                    functions.logger.error("Storage retention delete failed.", {
                        bucket: bucketName,
                        object: group[index].name,
                        reason: String(result.reason),
                    });
                }
            });
        }
        pageToken = nextQuery?.pageToken;
        if (scanned >= MAX_STORAGE_OBJECTS_PER_RUN || outOfTime(startedAt))
            break;
    } while (pageToken);
    return { scanned, deleted, failed, complete: !pageToken };
}
async function deleteStoragePrefixByAge(bucketName, prefix, retentionDays, startedAt) {
    return deleteStoragePrefix(bucketName, prefix, Date.now() - retentionDays * 24 * 60 * 60 * 1000, startedAt);
}
async function listRestaurantIds(startedAt) {
    const ids = [];
    let cursor;
    while (!outOfTime(startedAt)) {
        let query = db.collection("restaurants")
            .orderBy(firestore_1.FieldPath.documentId(), "asc")
            .limit(500);
        if (cursor)
            query = query.startAfter(cursor);
        const snapshot = await query.get();
        if (snapshot.empty)
            break;
        ids.push(...snapshot.docs.map((document) => document.id));
        cursor = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < 500)
            break;
    }
    return ids;
}
async function deleteTenantCollection(collectionName, restaurantId, startedAt) {
    let cursor;
    let deleted = 0;
    let failed = 0;
    while (!outOfTime(startedAt)) {
        let query = db.collection(collectionName)
            .where("restaurantId", "==", restaurantId)
            .orderBy(firestore_1.FieldPath.documentId(), "asc")
            .limit(PAGE_SIZE);
        if (cursor)
            query = query.startAfter(cursor);
        const snapshot = await query.get();
        if (snapshot.empty)
            break;
        const result = await deleteDocuments(snapshot.docs);
        deleted += result.deleted;
        failed += result.failed;
        cursor = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < PAGE_SIZE)
            break;
    }
    return { deleted, failed };
}
async function cleanupWorkspaceUserProfiles(restaurantId) {
    const membershipSnapshot = await db.collection("workspaceMembers")
        .where("restaurantId", "==", restaurantId)
        .get();
    const userIds = new Set();
    membershipSnapshot.docs.forEach((document) => {
        const data = document.data();
        if (data.userId)
            userIds.add(String(data.userId));
        if (data.uid)
            userIds.add(String(data.uid));
    });
    const legacyUsers = await db.collection("users").where("restaurantId", "==", restaurantId).get();
    legacyUsers.docs.forEach((document) => userIds.add(document.id));
    for (const userId of userIds) {
        const userRef = db.collection("users").doc(userId);
        const userSnapshot = await userRef.get();
        if (!userSnapshot.exists)
            continue;
        const user = userSnapshot.data() || {};
        const memberMap = user.memberships && typeof user.memberships === "object" ? user.memberships : {};
        const mappedIds = Object.entries(memberMap)
            .filter(([id, membership]) => id !== restaurantId && membership?.isActive !== false)
            .map(([id]) => id);
        const arrayIds = Array.isArray(user.workspaceIds)
            ? user.workspaceIds.map(String).filter((id) => id !== restaurantId)
            : [];
        const remainingMemberSnapshot = await db.collection("workspaceMembers")
            .where("userId", "==", userId)
            .get();
        const canonicalIds = remainingMemberSnapshot.docs
            .map((document) => document.data())
            .filter((membership) => membership.restaurantId !== restaurantId && membership.isActive !== false)
            .map((membership) => String(membership.restaurantId || ""))
            .filter(Boolean);
        const remainingIds = Array.from(new Set([...mappedIds, ...arrayIds, ...canonicalIds]));
        if (!remainingIds.length) {
            await userRef.delete();
            functions.logger.info("Deleted workspace-only Firestore user profile.", { userId, restaurantId });
            continue;
        }
        const fallbackRestaurantId = remainingIds[0];
        const updates = {
            [`memberships.${restaurantId}`]: firestore_1.FieldValue.delete(),
            workspaceIds: remainingIds,
            updatedAt: new Date().toISOString(),
        };
        if (user.restaurantId === restaurantId)
            updates.restaurantId = fallbackRestaurantId;
        if (user.activeRestaurantId === restaurantId)
            updates.activeRestaurantId = fallbackRestaurantId;
        if (user.defaultRestaurantId === restaurantId)
            updates.defaultRestaurantId = fallbackRestaurantId;
        await userRef.update(updates);
    }
}
async function deleteWorkspaceStorage(restaurantId, startedAt) {
    const bucket = storage.bucket();
    const prefixes = [`${restaurantId}/`, `events/${restaurantId}/`, `messages/${restaurantId}/`];
    for (const prefix of prefixes) {
        const result = await deleteStoragePrefix(bucket.name, prefix, Number.POSITIVE_INFINITY, startedAt);
        functions.logger.info("Workspace storage prefix purge completed.", {
            restaurantId,
            bucket: bucket.name,
            prefix,
            ...result,
        });
        if (!result.complete || outOfTime(startedAt)) {
            functions.logger.warn("Workspace storage cleanup is not finished. The workspace document will remain for the next daily pass.", {
                restaurantId,
                prefix,
            });
            return false;
        }
    }
    return true;
}
exports.purgeTransientOperationalData = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .pubsub.schedule("10 2 * * *")
    .timeZone(TIME_ZONE)
    .onRun(async () => {
    const startedAt = Date.now();
    await withJobLock("purgeTransientOperationalData", async () => {
        for (const rule of TRANSIENT_RULES) {
            const result = await purgeRule(rule, RETENTION_POLICY.transientDays, startedAt);
            functions.logger.info("Transient retention rule completed.", { policy: "transient-30-days", rule, ...result });
        }
        return null;
    });
    return null;
});
exports.purgeExpiredAiUploads = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("35 2 * * *")
    .timeZone(TIME_ZONE)
    .onRun(async () => {
    const startedAt = Date.now();
    await withJobLock("purgeExpiredAiUploads", async () => {
        const bucket = aiBucket();
        const cutoffMs = Date.now() - RETENTION_POLICY.rawAiDays * 24 * 60 * 60 * 1000;
        for (const prefix of ["ai_uploads/", "menuUploads/", "invoiceUploads/", "menu-scans/", "invoice-scans/"]) {
            const result = await deleteStoragePrefix(bucket.name, prefix, cutoffMs, startedAt);
            if (result.scanned || result.deleted || result.failed) {
                functions.logger.info("Legacy/global raw AI upload path purge completed.", { policy: "raw-ai-30-days", prefix, ...result });
            }
        }
        for (const rule of AI_PROMPT_RULES) {
            const result = await purgeRule(rule, RETENTION_POLICY.rawAiDays, startedAt);
            if (result.scanned || result.deleted || result.failed) {
                functions.logger.info("Raw AI prompt/request retention rule completed.", { policy: "raw-ai-30-days", rule, ...result });
            }
        }
        const restaurantIds = await listRestaurantIds(startedAt);
        for (const restaurantId of restaurantIds) {
            if (outOfTime(startedAt))
                break;
            for (const prefix of [
                `${restaurantId}/menuUploads/`,
                `${restaurantId}/invoices/scans/`,
                `${restaurantId}/invoiceUploads/`,
                `${restaurantId}/menu-scans/`,
                `${restaurantId}/invoice-scans/`,
                `restaurants/${restaurantId}/menuUploads/`,
                `restaurants/${restaurantId}/invoices/scans/`,
            ]) {
                const result = await deleteStoragePrefix(bucket.name, prefix, cutoffMs, startedAt);
                if (result.scanned || result.deleted || result.failed) {
                    functions.logger.info("86 Chaos raw AI upload path purge completed.", { policy: "raw-ai-30-days", restaurantId, prefix, ...result });
                }
            }
        }
        return null;
    });
    return null;
});
exports.archiveExpiredTimeClockData = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .pubsub.schedule("5 3 * * *")
    .timeZone(TIME_ZONE)
    .onRun(async () => {
    const startedAt = Date.now();
    await withJobLock("archiveExpiredTimeClockData", async () => {
        archiveBucket();
        for (const rule of ARCHIVE_RULES) {
            const result = await archiveRule(rule, RETENTION_POLICY.workforceArchiveAfterDays, startedAt);
            functions.logger.info("Time-clock/geofence archive rule completed.", { policy: "archive-after-1-year-retain-3-years", rule, ...result });
        }
        return null;
    });
    return null;
});
exports.purgeExpiredTimeClockArchives = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("40 3 * * *")
    .timeZone(TIME_ZONE)
    .onRun(async () => {
    const startedAt = Date.now();
    await withJobLock("purgeExpiredTimeClockArchives", async () => {
        const bucket = archiveBucket();
        let pageToken;
        let scanned = 0;
        let deleted = 0;
        do {
            const [filesRaw, nextQuery] = await bucket.getFiles({
                prefix: ARCHIVE_PREFIX,
                autoPaginate: false,
                maxResults: Math.min(1000, MAX_STORAGE_OBJECTS_PER_RUN - scanned),
                pageToken,
            });
            const files = filesRaw;
            scanned += files.length;
            const expired = files.filter((file) => {
                const value = file.metadata.metadata?.deleteAfter;
                return Boolean(value) && Date.parse(String(value)) <= Date.now();
            });
            for (const group of chunk(expired, 25)) {
                await Promise.all(group.map((file) => file.delete({ ignoreNotFound: true })));
                deleted += group.length;
            }
            pageToken = nextQuery?.pageToken;
            if (scanned >= MAX_STORAGE_OBJECTS_PER_RUN || outOfTime(startedAt))
                break;
        } while (pageToken);
        functions.logger.info("Expired time-clock archives purged.", { scanned, deleted });
        return null;
    });
    return null;
});
exports.purgeExpiredDatabaseBackups = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("55 3 * * *")
    .timeZone(TIME_ZONE)
    .onRun(async () => {
    const startedAt = Date.now();
    await withJobLock("purgeExpiredDatabaseBackups", async () => {
        const bucket = storage.bucket();
        const result = await deleteStoragePrefixByAge(bucket.name, "backups/firestore/", RETENTION_POLICY.backupDays, startedAt);
        functions.logger.info("Expired database backups purged.", { policy: "database-backups-30-days-rolling", bucket: bucket.name, prefix: "backups/firestore/", ...result });
        return null;
    });
    return null;
});
exports.purgeExpiredAuditSecurityLogs = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("25 4 * * *")
    .timeZone(TIME_ZONE)
    .onRun(async () => {
    const startedAt = Date.now();
    await withJobLock("purgeExpiredAuditSecurityLogs", async () => {
        for (const rule of AUDIT_SECURITY_RULES) {
            const result = await purgeRule(rule, RETENTION_POLICY.auditSecurityDays, startedAt);
            if (result.scanned || result.deleted || result.failed) {
                functions.logger.info("Audit/security retention rule completed.", { policy: "audit-security-1-year", rule, ...result });
            }
            if (outOfTime(startedAt))
                break;
        }
        return null;
    });
    return null;
});
exports.hardDeleteExpiredWorkspaces = functions
    .region(REGION)
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .pubsub.schedule("15 4 * * *")
    .timeZone(TIME_ZONE)
    .onRun(async () => {
    const startedAt = Date.now();
    await withJobLock("hardDeleteExpiredWorkspaces", async () => {
        const snapshot = await db.collection("restaurants")
            .where("deleted_at", "<", cutoffTimestamp(RETENTION_POLICY.deletedWorkspaceDays))
            .orderBy("deleted_at", "asc")
            .orderBy(firestore_1.FieldPath.documentId(), "asc")
            .limit(20)
            .get();
        for (const restaurant of snapshot.docs) {
            if (outOfTime(startedAt))
                break;
            const restaurantId = restaurant.id;
            await cleanupWorkspaceUserProfiles(restaurantId);
            for (const collectionName of TENANT_COLLECTIONS) {
                const result = await deleteTenantCollection(collectionName, restaurantId, startedAt);
                if (result.deleted || result.failed) {
                    functions.logger.info("Workspace collection purge completed.", {
                        restaurantId,
                        collectionName,
                        ...result,
                    });
                }
                if (outOfTime(startedAt))
                    break;
            }
            if (outOfTime(startedAt))
                break;
            const storageComplete = await deleteWorkspaceStorage(restaurantId, startedAt);
            if (!storageComplete || outOfTime(startedAt))
                break;
            await db.recursiveDelete(restaurant.ref);
            functions.logger.info("Workspace hard deletion completed.", { restaurantId });
        }
        return null;
    });
    return null;
});
//# sourceMappingURL=retention.js.map