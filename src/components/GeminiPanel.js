import React, { useState, useEffect, useRef } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "../css/gemini.css"; 

// ✅ YOUR API KEY
const API_KEY = "####"; 

export default function GeminiPanel({ isOpen, onClose }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "model", text: "Hi! I'm your Drive Assistant. How can I help you?" }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const newMessages = [...messages, { role: "user", text: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      
      // ⚠️ CHANGED MODEL TO 'gemini-pro' (This fixes the 404 error)
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      
      const result = await model.generateContent(input);
      const response = await result.response;
      const text = response.text();

      setMessages([...newMessages, { role: "model", text: text }]);
    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { role: "model", text: "Error connecting to Gemini. Please check your internet or API Key." }]);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="gemini-panel">
      {/* Header */}
      <div className="gemini-header">
        <span className="gemini-title">
          <span className="material-symbols-outlined" style={{color:'#1a73e8'}}>star_shine</span> 
          Gemini AI
        </span>
        <button className="gemini-close-btn" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Messages */}
      <div className="gemini-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`msg-bubble ${msg.role === 'user' ? 'msg-user' : 'msg-model'}`}>
            {msg.text}
          </div>
        ))}
        {loading && <div className="loading-text">Generating response...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="gemini-input-area">
        <input 
          className="gemini-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask me anything..."
          disabled={loading}
        />
        <button className="gemini-send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
           <span className="material-symbols-outlined" style={{fontSize: 20}}>send</span>
        </button>
      </div>
    </div>
  );
}