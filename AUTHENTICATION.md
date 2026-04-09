# Authentication System Guide

## Overview
The Dyslexic Kid Helper now features a multi-profile authentication system (Netflix-style) with database persistence.

## Authentication Flow

### Initial Load
```
App Start
  ↓
Check localStorage for saved profile & token
  ├→ Found: Skip to Main App
  └→ Not Found: Go to Profile Selection
```

### Profile Selection Screen
When no profile is logged in:
1. Fetch all existing profiles from `/api/profiles`
2. Display profiles in a grid (up to 3)
3. Allow user to:
   - Select a profile and enter password
   - Create a new profile (if < 3 exist)
   - Delete an existing profile

### Profile Creation Screen
1. Enter username (3+ characters)
2. Enter password (4+ characters)
3. Confirm password
4. Click "Create Profile"
5. Auto-login and redirect to main app

### Login Process
1. Select profile
2. Enter password
3. Backend validates credentials
4. JWT token returned
5. Token stored in localStorage
6. Token added to axios headers
7. Redirect to main app

## API Endpoints

### Get All Profiles
```
GET /api/profiles
Response:
{
  "profiles": [
    {
      "id": 1,
      "username": "alice",
      "created_at": "2024-03-10T..."
    }
  ],
  "total": 1,
  "max_profiles": 3
}
```

### Create New Profile
```
POST /api/profiles/create
Body:
{
  "username": "bob",
  "password": "password123"
}
Response:
{
  "message": "Profile created successfully",
  "profile": {
    "id": 2,
    "username": "bob",
    "created_at": "2024-03-10T..."
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Login to Profile
```
POST /api/profiles/login
Body:
{
  "username": "alice",
  "password": "password123"
}
Response:
{
  "message": "Login successful",
  "profile": {
    "id": 1,
    "username": "alice",
    "created_at": "2024-03-10T..."
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Delete Profile
```
DELETE /api/profiles/<profile_id>
Response:
{
  "message": "Profile deleted successfully"
}
```

## Frontend Components

### ProfileSelector
- Displays all existing profiles
- Allows login with password
- Allows profile deletion
- Routes to ProfileCreator for new profiles
- Shows max profile warning (3 limit)

### ProfileCreator
- Form for creating new profile
- Validates username (3+) and password (4+)
- Confirms password match
- Auto-logs in on successful creation
- Can go back to ProfileSelector

### App Component
- Manages `currentProfile` state
- Persists profile to localStorage
- Handles logout by clearing localStorage
- Routes between auth and main app

## Database

### Profiles Table
```sql
CREATE TABLE profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(80) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## Security Features

1. **Password Hashing**: Bcrypt with salt
2. **JWT Tokens**: Stateless session management
3. **Input Validation**: Username and password constraints
4. **Unique Usernames**: Enforced at database level
5. **Token Storage**: In localStorage (accessible by JS)
   - Consider using httpOnly cookies for production

## Session Persistence

- Profile saved to `localStorage.currentProfile`
- Token saved to `localStorage.authToken`
- Automatically loaded on app restart
- Cleared on logout

## Logout Flow

1. User clicks "Logout" button
2. Clear `currentProfile` from state
3. Clear localStorage
4. Clear axios Authorization header
5. Return to ProfileSelector

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Profile already exists" | Username taken | Choose different username |
| "Profile not found" | Wrong username | Check spelling |
| "Invalid username or password" | Wrong password | Re-enter correct password |
| "Maximum 3 profiles allowed" | Limit reached | Delete a profile first |
| "Username must be at least 3 characters" | Too short | Use longer username |
| "Password must be at least 4 characters" | Too short | Use longer password |

## Configuration

Set these in `.env`:

```env
JWT_SECRET_KEY=your-non-default-key-here
DATABASE_URL=sqlite:///profiles.db
REACT_APP_API_URL=http://localhost:5000
```

## Testing the System

### Test Case 1: Create Profile
1. Open app
2. Click "Create New Profile"
3. Enter username: test1
4. Enter password: test123
5. Confirm password: test123
6. Click "Create Profile"
7. Should see main app with profile "test1"

### Test Case 2: Logout & Login
1. Click logout button
2. Should see ProfileSelector
3. Select "test1" profile
4. Enter password: test123
5. Click Login
6. Should see main app with profile "test1"

### Test Case 3: Multiple Profiles
1. Click logout
2. Click "Create Another Profile"
3. Create profile "test2"
4. Click logout
5. Create profile "test3"
6. All three profiles should show in grid

### Test Case 4: Max Profiles
1. Have 3 profiles created
2. Try to create 4th profile
3. Should show error: "Maximum 3 profiles allowed"
4. Delete a profile
5. Can now create new profile

## Future Enhancements

1. [ ] Email-based password recovery
2. [ ] Parent account linking
3. [ ] Analytics per profile
4. [ ] Profile picture customization
5. [ ] Increase max profiles beyond 3
6. [ ] Account-level settings
7. [ ] Progress tracking per profile
