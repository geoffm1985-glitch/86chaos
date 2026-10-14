package com.chiltonappworks.chaos86;

final class BackExitGuard {
    private long armedUntil;
    boolean shouldExit(long now) {
        if (armedUntil > 0 && now <= armedUntil) { reset(); return true; }
        armedUntil = now + 2000;
        return false;
    }
    void reset() { armedUntil = 0; }
}
