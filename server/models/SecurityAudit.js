const mongoose = require('mongoose');

const SecurityAuditSchema = new mongoose.Schema(
    {
        eventType: {
            type: String,
            required: true,
            enum: [
                'LOGIN_SUCCESS',
                'LOGIN_FAILURE',
                'LOGOUT',
                'PASSWORD_CHANGE',
                'EMAIL_CHANGE',
                'ACCOUNT_LOCKOUT',
                'ACCOUNT_UNLOCK',
                'AUTH_FAILURE',
                'TOKEN_REVOKED',
                'UNAUTHORIZED_ACCESS',
                'ANOMALOUS_LOGIN',
                'API_RATE_LIMIT',
                'INVALID_REQUEST',
                'SUSPICIOUS_ACTIVITY',
                '2FA_ENABLED',
                '2FA_DISABLED',
                '2FA_VERIFICATION',
                'PASSWORD_RESET_REQUESTED',
                'PASSWORD_RESET_COMPLETED',
                'ACCOUNT_CREATION',
                'ACCOUNT_DELETION',
                'ROLE_CHANGE',
                'VALIDATION_FAILURE',
                'LOGIN_ANOMALY',
                'SERVER_ERROR',
                'LOW_RISK_ANOMALY',
                'HIGH_RISK_ANOMALY',
                'HIGH_FREQUENCY_TOKEN_USAGE',
                'PUBLIC_KEY_CREATED',
                'POTENTIAL_TOKEN_THEFT',
                'OVERSIZED_PAYLOAD',
                'PUBLIC_KEY_ACCESSED',
                'RATE_LIMIT_VIOLATION',
                'PRIVATE_MESSAGE_SENT',
            ],
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false, // Not all events are associated with a user
        },
        ip: {
            type: String,
            required: false,
        },
        userAgent: {
            type: String,
            required: false,
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
        },
        severity: {
            type: String,
            enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
            default: 'INFO',
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
);

// Index for better query performance
SecurityAuditSchema.index({eventType: 1, timestamp: 1});
SecurityAuditSchema.index({user: 1, timestamp: 1});
SecurityAuditSchema.index({ip: 1, timestamp: 1});
SecurityAuditSchema.index({timestamp: 1});

// Create text indexes for searching
SecurityAuditSchema.index({
    eventType: 'text',
    userAgent: 'text',
    'details.method': 'text',
    'details.path': 'text',
});

const SecurityAudit = mongoose.model('SecurityAudit', SecurityAuditSchema);

module.exports = SecurityAudit;