# Artificial-Intelligence-Conversation-Analyser-Project

PharmaFlow is an AI-powered sales intelligence platform that transforms real-world conversations between Sales Persons and Clients into structured insights and actionable decisions.

It uses voice analysis, AI processing, and role-based dashboards to improve sales effectiveness and managerial decision-making.

---

## Problem Statement

In traditional sales workflows:

* Conversations with clients are unstructured and not recorded effectively
* Managers lack visibility into field interactions
* Follow-ups are inconsistent and repetitive
* Decisions are based on intuition rather than data

---

## Solution

This project addresses these issues by:

* Capturing voice-based meeting inputs
* Using AI to extract key signals and insights
* Providing structured outputs and recommendations
* Enabling managers to monitor and act based on data

---

## Core Features

### Voice-Based Meeting Analysis

* Upload meeting recordings
* Extract client insights such as:

  * Interest level
  * Objections
  * Competitor mentions
  * Follow-up intent

---

### AI-Generated Outputs

1. Visit Summary
   A clear explanation of what happened during the meeting

2. Clent Signals
   Extracted indicators such as interest level, objections, and competitor presence

3. Prescription Probability
   A score (0–100%) representing likelihood of product adoption

4. Recommended Next Action
   A single best action based on analysis

5. Follow-up Brief
   Guidance for the next visit

6. Manager Flags
   Escalations for approvals or critical situations

---

### Role-Based Dashboards

Manager

* Assign tasks
* Monitor team performance
* Approve requests
* Handle escalations

Sales Person

* View assigned tasks
* Upload meeting recordings
* Track performance score
* Receive AI-driven recommendations

---

## Tech Stack

Frontend

* React.js
* Component-based architecture
* Context API for authentication

Backend

* Firebase Authentication
* Firebase Firestore

AI Layer

* Groq API for language model processing
* Speech-to-text and NLP analysis

Other

* Node.js for seed scripts
* Firestore security rules

---

## Project Structure

```bash
AIML VOICE ANALYSER
│
├── public/
├── scripts/
│   └── seed.js
├── src/
│   ├── components/
│   │   └── Shell.js
│   ├── context/
│   │   └── AuthContext.js
│   ├── firebase/
│   │   └── config.js
│   ├── pages/
│   │   ├── Login.js
│   │   ├── ManagerDashboard.js
│   │   ├── ManagerApprovals.js
│   │   ├── SPDashboard.js
│   │   ├── TaskDetail.js
│   │   └── ai.js
│   ├── App.js
│   └── index.js
│
├── firestore.rules
├── package.json
└── README.md
```

---

## Workflow

Sales Person records meeting
↓
Uploads audio
↓
AI processes conversation
↓
Extracts signals and insights
↓
Predicts outcome and suggests action
↓
Manager monitors or approves if required

---

## Database Design

Collections

users

* name
* email
* role
* performanceScore
* closureRate
* strengths
* avgDealSize

config

* discountPolicy
* escalationRules
* business constraints

---

## Key Highlights

* Converts unstructured conversations into structured insights
* Uses AI for decision support
* Implements real-world sales workflows
* Designed for future machine learning integration

---

## Future Enhancements

* Real-time speech-to-text integration
* Advanced machine learning models
* Notification system
* Multi-tenant support

---

## Project Definition

This is an AI-driven platform that transforms conversations between Sales Persons and Clients into structured insights, enabling Managers to make informed and timely decisions.

---

## Author

Antony Rojes M
BE Computer Science and Engineering
