# AI Features Guide

Optional AI-powered insights and recommendations using OpenAI with graceful fallbacks.

**Last Updated**: April 2026

## Overview

FutureMe integrates intelligent AI capabilities for:

- Burnout risk analysis
- Personalized recommendations
- Project risk assessment
- Workforce insights

All features are non-blocking with rule-based fallbacks when AI is unavailable.

## Configuration

### Environment Variables

```bash
OPENAI_API_KEY=your_openai_api_key_here  # Optional - AI features disabled if missing
```

### Rate Limiting

AI endpoints are rate-limited to 5 requests per hour per user to manage API costs and prevent abuse.

## AI-Powered Features

### 1. Executive Summary Generation

**Endpoint:** `POST /api/v1/insights/ai/executive-summary`

**Purpose:** Generate natural language executive reports combining organizational metrics with AI analysis.

**AI Processing:**

- Analyzes utilization rates, risk events, efficiency trends
- Provides business-focused insights and recommendations
- Uses GPT-3.5-turbo for cost-effective generation

**Fallback:** Rule-based summary using predefined templates

**Example Output:**

```json
{
  "aiEnabled": true,
  "executiveSummary": {
    "summary": "Organization processed 450 hours with 78% team utilization...",
    "keyHighlights": ["Strong team productivity", "Low risk profile"],
    "concerns": ["Slight efficiency decline"],
    "recommendations": ["Focus on continuous improvement"]
  }
}
```

### 2. Burnout Risk Analysis

**Endpoint:** `GET /api/v1/insights/ai/burnout-analysis/{userId}`

**Purpose:** Advanced burnout detection combining session patterns, overtime, and behavioral indicators.

**AI Processing:**

- Analyzes work patterns, late-night sessions, consecutive high-load days
- Provides risk scoring (0-100) with explanations
- Suggests specific interventions based on risk level

**Fallback:** Rule-based scoring using threshold-based calculations

**Example Output:**

```json
{
  "aiEnabled": true,
  "burnoutScore": 75,
  "riskLevel": "high",
  "explanation": "User shows high burnout risk based on 12+ hour days and late work sessions",
  "recommendedIntervention": "Schedule mandatory break time and review workload"
}
```

### 3. Project Risk Analysis

**Endpoint:** `GET /api/v1/insights/ai/project-risk/{projectId}`

**Purpose:** Scope creep and budget risk assessment using historical project data.

**AI Processing:**

- Compares current velocity against historical averages
- Predicts overrun probability and budget impact
- Suggests corrective actions

**Fallback:** Statistical analysis using standard deviation calculations

### 4. AI Recommendations Engine

**Endpoint:** `GET /api/v1/insights/ai/recommendations`

**Purpose:** Intelligent recommendations for workload optimization and risk mitigation.

**AI Processing:**

- Task reassignment suggestions based on utilization patterns
- Overtime prevention strategies
- Risk mitigation actions with priority levels

**Fallback:** Rule-based recommendations using workload balancing algorithms

## Security & Safety

### Input Sanitization

- All AI prompts are constructed server-side
- User inputs are not directly injected into prompts
- JSON responses are validated and parsed safely

### Rate Limiting

- 5 AI requests per hour per user
- Prevents API abuse and cost overruns
- User-based limiting (not IP-based for shared networks)

### Token Limits

- Maximum 500 tokens per AI request
- Prevents excessive API costs
- Focuses on concise, actionable outputs

### Prompt Injection Prevention

- No user-controlled prompt content
- Structured prompt templates with safe interpolation
- Input validation on all parameters

## Usage Monitoring

### Logging

AI usage is logged with metrics:

- Model used (gpt-3.5-turbo)
- Token consumption (prompt + completion)
- Estimated cost per request
- Success/failure rates

### Cost Estimation

- Rough cost calculation: $0.002 per 1K tokens
- Logged for billing and optimization
- Helps track AI feature ROI

## Fallback Behavior

When AI is unavailable (missing API key or API errors):

1. **Graceful Degradation:** Features continue working with rule-based logic
2. **Clear Indication:** Response includes `aiEnabled: false`
3. **Consistent Interface:** Same response structure regardless of AI availability
4. **No Blocking:** Requests complete successfully with fallback data

## Best Practices

### For Developers

- Always check `aiEnabled` flag in responses
- Handle both AI and fallback response formats
- Don't rely on AI for critical business logic
- Use AI features for insights and recommendations only

### For Users

- AI features enhance analysis but aren't required
- Fallback logic ensures core functionality always works
- Rate limits prevent overuse and maintain performance

## API Cost Management

### Current Pricing (GPT-3.5-turbo)

- $0.002 per 1K tokens
- Average request: ~300 tokens
- Cost per request: ~$0.0006

### Rate Limit Impact

- 5 requests/hour/user = 120 requests/day/user
- At $0.0006/request = $0.072/day/user
- For 100 users = $7.20/day (~$219/month)

### Optimization Strategies

- Use AI selectively for high-value insights
- Cache results where appropriate
- Monitor usage patterns
- Adjust rate limits based on usage

## Future Enhancements

### Planned Improvements

- GPT-4 integration for higher accuracy
- Custom fine-tuned models for domain-specific analysis
- Advanced prompt engineering
- Multi-language support

### Monitoring & Analytics

- AI performance metrics dashboard
- User satisfaction scoring
- Feature usage analytics
- Cost-benefit analysis
