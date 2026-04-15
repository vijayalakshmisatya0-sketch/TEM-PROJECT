# TEM Flight Operations Safety Analysis

Automated Threat and Error Management (TEM) framework processor for flight training observations. This application turns raw flight notes into structured safety data with visual evidence mapping.

## Features

- **AI-Powered Analysis**: Uses Gemini 3.1 Pro to identify Threats, Errors, and Undesired Aircraft States (UAS).
- **Visual Evidence Mapping**: Programmatically highlights source text in Word documents based on TEM categories.
- **Audit-Ready Reports**: Generates annotated `.docx` files for immediate visual audit trails.
- **Professional Dashboard**: Real-time visualization of safety findings across flight phases.

## Tech Stack

- **Frontend**: React, Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend**: Node.js, Express, Multer, Mammoth (Docx parsing), Docx (Docx generation).
- **AI**: Google Gemini API (@google/genai).

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd <repo-name>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

### Running the App

To start the development server (Full-stack mode):
```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Deployment

This app is designed to be deployed to platforms that support Node.js, such as **Google Cloud Run**, **Heroku**, or **Vercel** (with Serverless Functions).

---
*Built with Google AI Studio Build*
