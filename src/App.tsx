import React, { useState, useRef, useEffect } from 'react';
import { FileUp, Send, Trash2, FileText, ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadFile, generateContent } from './api/geminiApi';
import type { GeminiFile } from './api/geminiApi';
import './App.css';

interface Message {
  role: 'user' | 'model';
  text: string;
  image?: string;
}

function App() {
  const [file, setFile] = useState<GeminiFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [inputImage, setInputImage] = useState<{ mimeType: string; data: string } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setError(null);
      const uploadedFile = await uploadFile(selectedFile);
      setFile(uploadedFile);
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedImage = e.target.files?.[0];
    if (!selectedImage) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setInputImage({
        mimeType: selectedImage.type,
        data: base64,
      });
    };
    reader.readAsDataURL(selectedImage);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && !inputImage) return;
    if (!file) {
      setError('Please upload a document first.');
      return;
    }

    const currentInput = inputText;
    const currentImage = inputImage;
    
    // Add user message to UI
    setMessages(prev => [...prev, { 
      role: 'user', 
      text: currentInput, 
      image: currentImage ? `data:${currentImage.mimeType};base64,${currentImage.data}` : undefined 
    }]);

    setInputText('');
    setInputImage(null);
    setIsThinking(true);
    setError(null);

    try {
      const response = await generateContent(file.uri, file.mime_type, currentInput, currentImage || undefined);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err: any) {
      setError(err.message || 'Failed to get answer');
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const resetSession = () => {
    setFile(null);
    setMessages([]);
    setInputText('');
    setInputImage(null);
    setError(null);
  };

  return (
    <div className="app-container">
      <header className="glass">
        <div className="header-content">
          <div className="logo">
            <Sparkles className="icon-primary" />
            <h1>DocQA Tool</h1>
          </div>
          {file && (
            <button className="btn-reset" onClick={resetSession}>
              <Trash2 size={16} />
              <span>New Document</span>
            </button>
          )}
        </div>
      </header>

      <main>
        {!file ? (
          <div className="upload-section">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="upload-card glass"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile) {
                  const event = { target: { files: [droppedFile] } } as any;
                  handleFileUpload(event);
                }
              }}
            >
              <div className="upload-icon-wrapper">
                {isUploading ? (
                  <Loader2 className="animate-spin" size={48} />
                ) : (
                  <FileUp size={48} />
                )}
              </div>
              <h2>Upload Document</h2>
              <p>Drag and drop or click to browse</p>
              <span className="file-types">PDF, TXT, MD, CSV, Images</span>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                hidden 
                accept=".pdf,.txt,.md,.csv,image/*" 
              />
              <button 
                className="btn-primary" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Select File'}
              </button>
            </motion.div>
          </div>
        ) : (
          <div className="chat-section">
            <div className="doc-sidebar glass">
              <h3>Current Document</h3>
              <div className="file-info glass-card">
                <FileText size={20} />
                <div className="file-details">
                  <span className="file-name">{file.display_name}</span>
                  <span className="file-status">LOADED</span>
                </div>
              </div>
              <div className="instructions">
                <p>Ask questions about this document. Gemini will answer strictly based on its content.</p>
              </div>
            </div>

            <div className="chat-container">
              <div className="messages-list">
                <AnimatePresence>
                  {messages.map((msg, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`message-bubble ${msg.role}`}
                    >
                      {msg.image && (
                        <div className="message-image">
                          <img src={msg.image} alt="User upload" />
                        </div>
                      )}
                      <div className="message-text">
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                  {isThinking && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="message-bubble model thinking"
                    >
                      <div className="dots">
                        <span></span><span></span><span></span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              <div className="input-box glass">
                {inputImage && (
                  <div className="image-preview glass-card">
                    <img src={`data:${inputImage.mimeType};base64,${inputImage.data}`} alt="Preview" />
                    <button onClick={() => setInputImage(null)} className="btn-remove-img">×</button>
                  </div>
                )}
                <div className="input-wrapper">
                  <button 
                    className="btn-icon" 
                    onClick={() => imageInputRef.current?.click()}
                    title="Upload image of questions"
                  >
                    <ImageIcon size={20} />
                  </button>
                  <input 
                    type="file" 
                    ref={imageInputRef} 
                    onChange={handleImageInput} 
                    hidden 
                    accept="image/*" 
                  />
                  <textarea 
                    placeholder="Type your question... (Shift+Enter for new line)"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button 
                    className="btn-send" 
                    onClick={handleSendMessage}
                    disabled={(!inputText.trim() && !inputImage) || isThinking}
                  >
                    {isThinking ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {error && (
        <div className="error-toast glass">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
}

export default App;
