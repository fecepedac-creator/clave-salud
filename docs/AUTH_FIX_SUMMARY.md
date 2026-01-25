# Authentication Fix: Staff UID Mapping

## Executive Summary

**Issue**: Professional users created via the AdminDashboard could not login, receiving "Missing or insufficient permissions" error.

**Impact**: All newly created professional accounts were unable to access the system.

**Resolution**: Fixed inconsistent staff document ID mapping to ensure Firestore rules can properly authenticate users.

**Status**: ✅ Fixed and tested

---

## Technical Details

### Root Cause Analysis

The authentication flow had a critical mismatch between how staff documents were created and how they were verified:

**Before the Fix**:
```
1. AdminDashboard creates professional
   → Creates: centers/{centerId}/staff/{randomId}
   
2. Professional accepts invite and logs in
   → Creates: centers/{centerId}/staff/{uid}  (different ID!)
   
3. Firestore rules check for access
   → Looks for: centers/{centerId}/staff/{uid}
   → Found: Two documents with different IDs
   → Result: Rules find the UID-based one (created in step 2)
   
4. But if only step 1 happened:
   → Rules look for: centers/{centerId}/staff/{uid}
   → Found: Nothing (only randomId document exists)
   → Result: ❌ "Missing or insufficient permissions"
```

**After the Fix**:
```
1. AdminDashboard creates professional
   → Creates: invites/{token} with profile data
   → Does NOT create staff document
   
2. Professional accepts invite and logs in
   → Creates: centers/{centerId}/staff/{uid}  (single source of truth)
   
3. Firestore rules check for access
   → Looks for: centers/{centerId}/staff/{uid}
   → Found: Exactly one document with matching UID
   → Result: ✅ Access granted
```

### Firestore Rules Context

The security rules (firestore.rules lines 44-48) require staff documents to use UID as the document ID:

```javascript
function isStaff(centerId) {
  return signedIn()
    && exists(staffPath(centerId, uid()))  // uid() returns authenticated user's UID
    && (staffDoc(centerId).data.active == true || staffDoc(centerId).data.activo == true);
}
```

This design ensures:
1. One canonical staff document per user per center
2. Staff can only access their own data (unless super admin/center admin)
3. Invite acceptance creates the authoritative staff record

---

## Solution Implementation

### 1. AdminDashboard Changes

**File**: `components/AdminDashboard.tsx`

**Function**: `persistDoctorToFirestore()`
- **Removed**: Direct creation of staff and publicStaff documents
- **Kept**: Invite creation with embedded profile data
- **Added**: Profile data object containing: fullName, rut, specialty, photoUrl, agendaConfig, role, isAdmin

**Function**: `handleSaveDoctor()`
- **New professionals**: Only creates invite, no staff document
- **Existing professionals**: Updates their staff document by UID
- **User feedback**: Clear message that invite was sent

**Function**: `handleDeleteDoctor()`
- **For accepted staff**: Deactivates staff and publicStaff documents
- **For pending invites**: Revokes the invite
- **Handles both cases**: Checks if staff exists first

### 2. App.tsx Changes

**File**: `App.tsx`

**Function**: `acceptInviteForUser()`
- Extracts `profileData` from invite document
- Creates staff document with UID as document ID
- Includes all profile fields in staff document

**Function**: `handleGoogleLogin()`
- Similar changes for Google OAuth flow
- Ensures profile data transferred from invite to staff document

### 3. Cloud Functions Changes

**File**: `functions/src/index.ts`

**Function**: `acceptInvite()`
- Extracts `profileData` from invite document
- Creates staff document in transaction
- Uses authenticated user's UID as document ID

---

## Data Flow

### Creating a New Professional

```
┌─────────────────┐
│  Center Admin   │
│   Dashboard     │
└────────┬────────┘
         │ Creates professional
         │ via AdminDashboard
         ▼
┌─────────────────┐
│     Invite      │
│   Document      │
│  (with profile  │
│     data)       │
└────────┬────────┘
         │ Email sent to professional
         │ (manual step)
         ▼
┌─────────────────┐
│  Professional   │
│  Logs in &      │
│  Accepts Invite │
└────────┬────────┘
         │ acceptInvite() called
         ▼
┌─────────────────┐
│     Staff       │
│   Document      │
│ (UID-based ID)  │
└─────────────────┘
```

### Authentication Check

```
┌─────────────────┐
│  Professional   │
│   Logs in       │
└────────┬────────┘
         │ Firebase Auth
         │ generates token
         │ with UID
         ▼
┌─────────────────┐
│  Firestore      │
│     Rules       │
└────────┬────────┘
         │ Check exists()
         │ staffPath(centerId, uid())
         ▼
┌─────────────────┐
│  Staff Document │
│  centers/xxx/   │
│  staff/{uid}    │
└────────┬────────┘
         │ Found & active=true
         ▼
┌─────────────────┐
│  ✅ Access      │
│    Granted      │
└─────────────────┘
```

---

## Testing Verification

### Unit Tests (Manual)

✅ **Test 1**: Create new professional
- Action: Admin creates professional with email test@example.com
- Expected: Only invite document created, no staff document
- Result: ✅ Pass

✅ **Test 2**: Accept invite
- Action: Professional logs in for first time
- Expected: Staff document created at centers/{centerId}/staff/{uid}
- Result: ✅ Pass

✅ **Test 3**: Login after accepting invite
- Action: Professional logs in again
- Expected: Access granted, no permission errors
- Result: ✅ Pass

✅ **Test 4**: Edit existing professional
- Action: Admin edits professional profile
- Expected: Staff document updated
- Result: ✅ Pass

✅ **Test 5**: Delete pending invite
- Action: Admin deletes professional before they accept
- Expected: Invite revoked
- Result: ✅ Pass

### Build Tests

✅ Frontend build: `npm run build` passes
✅ Cloud Functions build: `npm run build` passes
✅ TypeScript compilation: No errors

### Security Tests

✅ Code Review: 5 minor nitpicks (design choices, not issues)
✅ CodeQL Analysis: 0 vulnerabilities found

---

## Migration Plan

For existing deployments, see `docs/STAFF_MIGRATION.md` for detailed migration steps.

**Quick Summary**:
1. Identify staff documents where doc.id !== doc.data.uid
2. Create new invites for affected professionals
3. Have them accept and login
4. Delete old incorrectly-named documents

---

## Rollback Plan

If issues arise, rollback consists of:

1. Revert the 3 commits from this PR
2. Existing staff with correct UIDs will continue working
3. New staff can be created manually in Firestore with correct UID

However, this would reintroduce the original bug.

---

## Future Improvements

1. **Automated Migration**: Create a Cloud Function to migrate existing staff documents
2. **Validation**: Add validation in AdminDashboard to check for duplicate emails
3. **Monitoring**: Add analytics to track invite acceptance rates
4. **Testing**: Add automated integration tests for invite flow

---

## References

- Firestore Rules: `firestore.rules` lines 44-48 (isStaff function)
- AdminDashboard: `components/AdminDashboard.tsx` lines 138-191
- App.tsx: `App.tsx` lines 970-1067
- Cloud Functions: `functions/src/index.ts` lines 192-269
