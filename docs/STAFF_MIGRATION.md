# Staff Document Migration Guide

## Background

**Issue Fixed**: Professional users could not login due to inconsistent staff document IDs.

**Root Cause**: AdminDashboard was creating staff documents with random IDs (`centers/{centerId}/staff/{randomId}`) instead of using the authenticated user's UID (`centers/{centerId}/staff/{uid}`).

**Solution**: Staff documents are now ONLY created when an invite is accepted, using the authenticated user's UID.

## For Existing Deployments

If your deployment has existing staff documents with incorrect IDs (random IDs instead of UIDs), follow this migration process:

### Step 1: Identify Affected Staff

Run this query in Firestore console to find staff documents where `id` doesn't match `uid`:

```javascript
// In Firestore console, navigate to each center's staff collection
// Look for documents where doc.id !== doc.data.uid
```

### Step 2: For Each Affected Staff Member

For each staff member with mismatched ID/UID:

1. **If they have NOT accepted their invite yet**:
   - The invite still exists in the `invites` collection
   - When they accept the invite, a NEW staff document will be created with the correct UID
   - After they login successfully, you can DELETE the old incorrectly-named staff document

2. **If they HAVE accepted their invite and are trying to login**:
   - They will see "Missing or insufficient permissions" error
   - Create a new invite for them using the AdminDashboard
   - Ask them to accept the new invite
   - This will create the correct UID-based staff document
   - Delete the old incorrectly-named staff document

### Step 3: Verify Access

After migration:
1. Professional logs in using Google or email/password
2. System checks for `centers/{centerId}/staff/{uid}` where `uid` is their authenticated UID
3. Access is granted if document exists and `active == true`

## Prevention

The fix ensures this issue doesn't happen again:
- AdminDashboard now ONLY creates invites (no direct staff documents)
- Staff documents are ONLY created when invite is accepted
- Document ID always matches the authenticated user's UID

## Testing the Fix

To test the fix works correctly:

1. As a Center Admin, create a new professional using AdminDashboard
2. Verify that ONLY an invite document is created (no staff document yet)
3. Professional receives invite and accepts it by logging in
4. Verify staff document is created at `centers/{centerId}/staff/{uid}` where `uid` is their auth UID
5. Professional can now access the system without permission errors

## Related Files

- `components/AdminDashboard.tsx`: Creates invites only
- `App.tsx`: Handles invite acceptance and staff document creation
- `functions/src/index.ts`: Cloud function for invite acceptance
- `firestore.rules`: Security rules requiring UID-based paths
