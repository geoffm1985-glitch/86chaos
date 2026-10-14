package com.chiltonappworks.chaos86;

import org.junit.Test;
import static org.junit.Assert.*;

public class BackExitGuardTest {
    @Test public void firstPressWarnsAndSecondPressExitsOnce() {
        BackExitGuard guard = new BackExitGuard();
        assertFalse(guard.shouldExit(100));
        assertTrue(guard.shouldExit(500));
        assertFalse(guard.shouldExit(600));
    }
    @Test public void expiredWarningCannotCloseApp() {
        BackExitGuard guard = new BackExitGuard();
        assertFalse(guard.shouldExit(100));
        assertFalse(guard.shouldExit(2101));
    }
    @Test public void navigatingOrBackgroundingDisarmsExit() {
        BackExitGuard guard = new BackExitGuard();
        assertFalse(guard.shouldExit(100)); guard.reset();
        assertFalse(guard.shouldExit(500));
    }
}
