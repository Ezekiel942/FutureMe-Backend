# FutureMe User Guide

Complete guide for using FutureMe after deployment.

## Getting Started

### First Login

1. **Navigate to FutureMe**
   - Visit `https://yourdomain.com` (or your deployment URL)
   - You should see the login page

2. **Register Account**
   - Click **"Create a new account"** link on the login page
   - Enter:
     - **Email**: Your work email address
     - **Password**: A strong password (8+ characters)
   - Click **"Sign up"**
   - You'll be redirected to the login page

3. **Log In**
   - Enter your email and password
   - Click **"Login"**
   - You'll be directed to your personal dashboard

## Dashboard Overview

After logging in, you'll see:

## API Endpoints for Power Users

- `GET /api/v1/sessions/active` - returns active session
- `GET /api/v1/sessions` - list sessions (paging)
- `POST /api/v1/sessions` - start session
- `POST /api/v1/sessions/:sessionId/pause` - pause a session
- `POST /api/v1/sessions/:sessionId/resume` - resume a session
- `POST /api/v1/sessions/:sessionId/end` - end session
- `GET /api/health` - health check
- `GET /api/health/ready` - readiness
- `GET /api/v1/insights/*` - analytics and AI

After logging in, you'll see:

### Session Dashboard

- **Active Sessions**: View currently running work sessions
- **Session History**: See past sessions with duration, focus time, and insights
- **Quick Start**: Begin a new session immediately

### Navigation Menu (Left Sidebar)

- **Dashboard**: Main session overview
- **Sessions**: Full session history and details
- **Billing**: View subscription and payment information
- **Audit**: View your account activity history
- **Insights**: Analyze your work patterns and productivity metrics

## Session Management

### Starting a Session

1. Click **"Start Session"** on the dashboard
2. You'll see a session timer and focus tracking begins
3. During the session:
   - Track your active work time
   - System monitors your activity
   - Focus time is automatically calculated

### Session States

A session can be in one of these states:

- **Running**: Currently active, time is being tracked
- **Paused**: Session is paused, you can resume later
- **Completed**: Session has ended

### Ending a Session

1. Click **"End Session"** when you're done working
2. The system will:
   - Calculate total session duration
   - Determine focus time (active work vs idle)
   - Generate insights about your session
   - Show you key metrics

### Session Details

Click on any session to view:

- **Duration**: Total time the session lasted
- **Focus Time**: How long you were actively working
- **Focus Rate**: Percentage of time you were focused (focus_time / total_time)
- **Insights**: AI-generated observations about your work patterns
- **Breaks**: How many breaks you took

## Billing & Subscriptions

### Current Plan

The **Billing** page shows:

- Your current subscription tier
- Renewal date
- Monthly billing cycle

### Available Plans

FutureMe offers three tiers:

**Basic** - $9/month

- 50 sessions per month
- Basic insights
- Community support

**Pro** - $29/month

- Unlimited sessions
- Advanced insights with anomaly detection
- Email support
- Session analytics and reports

**Enterprise** - Custom pricing

- All Pro features
- Priority support
- Custom integrations
- Advanced team features

### Upgrading Your Plan

1. Go to **Billing** page
2. Find your desired plan under "Available Plans"
3. Click **"Upgrade"** (or **"Downgrade"**)
4. Complete the payment process
5. Your plan change is effective immediately

### Payment Methods

- Credit/Debit cards (Visa, Mastercard, American Express)
- PayPal (if configured)

### Billing History

View all previous charges and invoices in the "Billing History" section.

## Insights & Analytics

### Understanding Insights

The **Insights** page shows AI-generated observations about your work patterns:

#### Utilization Insights

Shows patterns in how you use the system:

- **Peak hours**: When you typically work most productively
- **Focus consistency**: How consistent your focus levels are across sessions
- **Session duration**: Average length of your work sessions

#### Deviation Insights

Highlights unusual patterns:

- **Anomaly detection**: Alerts when your behavior deviates from your baseline
- **Low focus sessions**: Flags sessions with below-average focus rates
- **Unusual patterns**: Identifies unexpected changes in your work habits

### Severity Levels

Each insight has a severity indicator:

- 🟢 **Green (Low)**: Informational, normal variation
- 🟡 **Yellow (Medium)**: Worth noting, slight deviation from baseline
- 🔴 **Red (High)**: Significant anomaly, may indicate issues with focus or work habits

### Using Insights

Insights help you:

- Identify your most productive times
- Understand focus patterns
- Detect productivity challenges
- Improve work habits over time

## Audit Log

The **Audit** page shows all account activities:

- Login times
- Session creation/completion
- Plan changes
- Any account modifications

This helps you:

- Monitor account security
- Track billing events
- Maintain compliance records

## Privacy & Security

### Your Data

- All your session data and insights are private to your account
- Data is encrypted in transit (HTTPS) and at rest
- Only you can see your sessions and insights

### Authentication

- Your password is hashed using bcrypt
- Passwords are never stored in plain text
- Session tokens (JWT) expire for security

### Two-Factor Authentication (Enterprise)

Enterprise accounts can enable optional 2FA:

1. Go to **Account Settings**
2. Enable **Two-Factor Authentication**
3. Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
4. Verify with 6-digit code

## Organization Management (Enterprise/Team Features)

### Creating an Organization

1. Navigate to **Organizations** (if available)
2. Click **"Create Organization"**
3. Enter organization name and details
4. Invite team members by email

### Managing Team Members

- **Invite**: Send invitations to team members
- **Role Assignment**: Assign roles (Admin, Manager, Member)
- **Permissions**:
  - **Admin**: Full access to organization settings
  - **Manager**: Can view team analytics and sessions
  - **Member**: Can only view own sessions

### Team Analytics

Managers and Admins can:

- View aggregated team productivity metrics
- See team member insights
- Generate team reports
- Manage billing for the organization

## Common Tasks

### Export Session Data

1. Go to **Sessions** page
2. Select date range
3. Click **"Export"**
4. Choose format (CSV or JSON)

### Change Password

1. Click your profile icon (top right)
2. Select **"Account Settings"**
3. Click **"Change Password"**
4. Enter current and new password
5. Click **"Update"**

### Delete Account

1. Go to **Account Settings**
2. Scroll to **"Danger Zone"**
3. Click **"Delete Account"**
4. Confirm deletion (this is irreversible)

## Troubleshooting

### Can't Log In

- Verify your email address is correct
- Check Caps Lock is off
- Use **"Forgot Password"** to reset password
- Wait 1 minute and try again (account lockout protection)

### Sessions Not Tracking

- Ensure your browser has permissions to track activity
- Check internet connection
- Refresh the page
- Contact support if issue persists

### Insights Not Showing

- You need at least 5 sessions to generate insights
- Wait 24-48 hours for system to analyze your patterns
- Ensure your plan includes insight generation

### Billing Issues

- Verify your payment method is valid
- Check for sufficient funds/credit
- Contact billing support for failed charges

### WebSocket Connection Issues

If real-time updates aren't working:

- Refresh your browser
- Check firewall/proxy for WebSocket blocking
- Try disabling browser extensions
- Contact support with error details from browser console

## Support

### Getting Help

- **Email**: support@worksight.com
- **Chat**: In-app chat support (Pro/Enterprise)
- **Documentation**: https://docs.worksight.com
- **Status Page**: https://status.worksight.com

### Reporting Issues

1. Note the exact error message or behavior
2. Include your browser and OS version
3. Provide steps to reproduce the issue
4. Include any relevant screenshots
5. Email to support with as much detail as possible

## Tips for Success

### Maximizing Productivity

1. **Start sessions consistently**: Same time each day helps build habits
2. **Monitor your insights**: Use patterns to identify peak hours
3. **Act on anomalies**: If focus drops, investigate what changed
4. **Review regularly**: Check insights weekly to track progress
5. **Use breaks strategically**: Don't force non-stop focus

### Best Practices

- Start sessions immediately when work begins (not at the end)
- End sessions as soon as work ends (don't include break time)
- Use multiple focused sessions rather than one long session
- Review insights during weekly planning
- Adjust your schedule based on your peak hours

### Privacy Tips

- Log out when using shared computers
- Use strong, unique passwords
- Enable 2FA if available
- Regularly review audit logs
- Update password every 90 days

## FAQ

**Q: Can I delete a specific session?**
A: Sessions are permanent records for audit and analytics purposes. Contact support to request deletion.

**Q: Can I export my data?**
A: Yes, use the Export function in the Sessions page. Data is available in CSV and JSON formats.

**Q: What happens to my data if I cancel?**
A: Your data is retained for 30 days after cancellation. After 30 days, it's permanently deleted.

**Q: Can multiple people use the same account?**
A: No, each person should have their own account. For teams, use organizational features (Enterprise).

**Q: How accurate is the focus tracking?**
A: Focus tracking uses activity monitoring and is approximately 95% accurate. Some variance is normal.

**Q: Is my data shared with third parties?**
A: No, your data is never shared. We comply with GDPR, CCPA, and other privacy regulations.

## Keyboard Shortcuts

- `S` - Start new session
- `E` - End current session
- `D` - Go to dashboard
- `I` - Go to insights
- `?` - Show help

---

**Welcome to FutureMe!** Start tracking your productivity today.
