package com.throughline.weeklycommit.application.lifecycle;

/** Spring application event fired AFTER_COMMIT when a week transitions DRAFT → LOCKED. */
public record WeekLockedEvent(String weekId, String userId, String orgId) {}
