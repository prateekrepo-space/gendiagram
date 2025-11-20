# AI Diagram Maker

A modern MERN stack application that generates Mermaid.js diagrams from natural language descriptions using Google's Gemini AI.

## Features
- **AI-Powered Generation**: Convert text to Flowcharts, Sequence, Class, and State diagrams.
- **Real-time Rendering**: Instantly preview diagrams using Mermaid.js.
- **Export Options**: Download diagrams as SVG or PNG, or copy the code.
- **Modern UI**: Built with React, Tailwind CSS, and Lucide icons.

## Quick Start

### Prerequisites
- Node.js
- Google Gemini API Key

### Setup

1. **Backend**
   ```bash
   cd server
   npm install
   # Create .env file with GEMINI_API_KEY=your_key
   node server.js
   ```

2. **Frontend**
   ```bash
   cd client
   npm install
   npm run dev
   ```


## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, Mermaid.js
- **Backend**: Node.js, Express, Google Generative AI SDK
