package com.throughline.weeklycommit.application.lifecycle;

/** Spring application event fired AFTER_COMMIT when a week transitions RECONCILING → RECONCILED. */
public record WeekReconciledEvent(String weekId, String userId, String orgId) {}
