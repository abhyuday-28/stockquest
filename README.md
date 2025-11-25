StockQuest – Stock Portfolio App

StockQuest is a simple full-stack stock portfolio tracker built with a React frontend and a Node.js/Express backend.
The goal of the project was to demonstrate a clean UI, basic portfolio calculations, and a smooth client–server flow using mock data.

📌 Features

View mock stock data served from a Node backend

Responsive dashboard built with React

Basic gain/loss calculation

Simple and clean component structure

Fetching data from REST API endpoints

Easy to run locally (both frontend & backend)

📁 Tech Stack

Frontend: React, JavaScript, CSS
Backend: Node.js, Express
Data: Local JSON mock data

🎥 Demo Video

Link: https://drive.google.com/file/d/1DLF87cBaixLPfauQaPD3AUrz0Zj9rEZO/view?usp=sharing

📦 Project Structure
stockquest/
│
├── backend/        # Node.js + Express API
│   ├── data/       # Mock JSON
│   ├── routes/
│   └── server.js
│
└── client/         # React frontend
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   └── App.js
    └── public/

⚙️ Running the Project Locally
1. Clone the repository
git clone https://github.com/abhyuday-28/stockquest.git
cd stockquest

2. Backend Setup
cd backend
npm install
npm start


The server will usually run on:
http://localhost:5000

3. Frontend Setup

Open a new terminal:

cd client
npm install
npm start


React will start on:
http://localhost:3000



📝 Assumptions

Stock prices are mock values served from a JSON file.

No authentication included since the focus is purely on UI + API flow.

Portfolio logic is kept intentionally simple for demonstration.

⭐ Extras / Bonus

Clean UI with responsive layout

Component-based structure for reusability

Video walkthrough added

Simple Node API instead of static JSON
