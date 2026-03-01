# 🐱 Les Chats Qui Pètent

<div align="center">
  <img src="frontend/public/pixel-cat-logo.png" alt="Pixel Cat Logo" width="200"/>
  <p><i>A high-stakes, real-time Taboo-style game where humans and AI collide.</i></p>
  <br/>
  <a href="https://aiheardthat.live"><strong>🌐 LIVE DEMO: aiheardthat.live</strong></a>
</div>

---


## 🇸🇬 Mistral Worldwide Hackathon - Singapore

This project was developed for the **[Mistral Worldwide Hackathon](https://worldwide-hackathon.mistral.ai/)** in **Singapore**.

**Team: Les Chats Qui Pètent**
*   4 members based in Singapore.
*   Built with ❤️ and Mistral AI.

---

## 🎮 Project Overview

**Les Chats Qui Pètent** is a real-time, multiplayer Taboo-style game. One player acts as the **Game Master (GM)**, describing a secret target word without using forbidden "taboo" words. 

**The twist?** Both human players and a **Mistral-powered AI Guesser** are listening to the live transcript and racing to be the first to guess the word.

### Key Features
- **Live Voice Streaming**: GM's speech is transcribed in real-time.
- **AI vs. Humans**: A competitive environment where the AI learns from previous incorrect guesses.
- **Multimodal Input**: Players can guess via text or voice.
- **Real-time Synchronization**: Powered by WebSockets for a seamless experience.

---

## 📖 Documentation

Explore the technical details and game mechanics:

*   **[Game Flow & Rules](gameflow.md)**: A comprehensive guide to roles, rules, and the WebSocket state machine.
*   **[Backend Architecture](backend/game-logic.md)**: Deep dive into concurrency, locking, and the AI guesser loop.
*   **[Frontend Setup](frontend/README.md)**: Information on the React + Vite + TypeScript frontend.

---

## 🔗 Quick Links
- **Live Demo**: [aiheardthat.live](https://aiheardthat.live)
- **Official Hackathon Site**: [worldwide-hackathon.mistral.ai](https://worldwide-hackathon.mistral.ai/)
- **Singapore Event Details**: [luma.com/mistralhack-singapore](https://luma.com/mistralhack-singapore)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

