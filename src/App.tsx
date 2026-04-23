import React, { useState, useRef, useEffect } from 'react';
import { FileUp, Send, Trash2, FileText, ImageIcon, Loader2, Sparkles, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadFile, generateContent, AVAILABLE_MODELS } from './api/geminiApi';
import type { GeminiFile } from './api/geminiApi';
import ReactMarkdown from 'react-markdown';
import './App.css';

interface Message {
  role: 'user' | 'model';
  text: string;
  image?: string;
  isError?: boolean;
}

function App() {
  const [file, setFile] = useState<GeminiFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [inputImage, setInputImage] = useState<{ mimeType: string; data: string } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<{ text: string, image?: any } | null>(null);

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

  const handleSendMessage = async (retryData?: { text: string, image?: any }) => {
    const textToSend = retryData ? retryData.text : inputText;
    const imageToSend = retryData ? retryData.image : inputImage;

    if (!textToSend.trim() && !imageToSend) return;
    if (!file) {
      setError('Please upload a document first.');
      return;
    }
    
    // Save for potential retry
    setLastAttempt({ text: textToSend, image: imageToSend });

    if (!retryData) {
      setMessages(prev => [...prev, { 
        role: 'user', 
        text: textToSend, 
        image: imageToSend ? `data:${imageToSend.mimeType};base64,${imageToSend.data}` : undefined 
      }]);
      setInputText('');
      setInputImage(null);
    }

    setIsThinking(true);
    setError(null);

    // If it was an error before, remove the last error message for a cleaner UI on retry
    if (retryData) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.isError) return prev.slice(0, -1);
        return prev;
      });
    }

    try {
      const response = await generateContent(file.uri, file.mime_type, textToSend, selectedModel, imageToSend || undefined);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err: any) {
      if (err.type === 'HIGH_DEMAND') {
        setError(err);
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `**ERROR:** The model **${selectedModel}** is currently overloaded.\n\nThis is usually temporary. You can try again in a few seconds or switch to a different model in the header.`,
          isError: true
        }]);
      } else {
        setError(err.message || 'Failed to get answer');
      }
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
    setLastAttempt(null);
  };

  return (
    <div className="app-container">
      <header className="glass">
        <div className="header-content">
          <div className="logo">
            <Sparkles className="icon-primary" />
            <h1>DocQA Tool</h1>
          </div>
          
          <div className="header-actions">
            <div className="model-selector-wrapper">
              <button 
                className={`btn-model-selector glass-card ${showModelSelector ? 'active' : ''}`} 
                onClick={() => setShowModelSelector(!showModelSelector)}
              >
                <div className="model-info">
                  <span className="model-label">AI Intelligence:</span>
                  <span className="model-current">{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name}</span>
                </div>
                <ChevronDown size={14} className={showModelSelector ? 'rotate-180' : ''} />
              </button>
              
              <AnimatePresence>
                {showModelSelector && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="model-dropdown glass"
                  >
                    <div className="dropdown-header">Select Model</div>
                    {AVAILABLE_MODELS.map(m => (
                      <button 
                        key={m.id} 
                        className={`model-option ${selectedModel === m.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedModel(m.id);
                          setShowModelSelector(false);
                        }}
                      >
                        <div className="option-name">
                          {m.name}
                          {m.recommended && <span className="badge">Recommended</span>}
                        </div>
                        <div className="option-desc">{m.desc}</div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {file && (
              <button className="btn-reset" onClick={resetSession}>
                <Trash2 size={16} />
                <span>Reset</span>
              </button>
            )}
          </div>
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
              <h2>Ready to Analyze</h2>
              <p>Drag and drop or click to browse</p>
              <span className="file-types">PDF, Word, TXT, MD, CSV, Images</span>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                hidden 
                accept=".pdf,.doc,.docx,.txt,.md,.csv,image/*" 
              />
              <button 
                className="btn-primary" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Choose File'}
              </button>
            </motion.div>
          </div>
        ) : (
          <div className="chat-section">
            <div className="doc-sidebar glass">
              <h3>Active Document</h3>
              <div className="file-info glass-card">
                <FileText size={20} />
                <div className="file-details">
                  <span className="file-name">{file.display_name}</span>
                  <span className="file-status">READY</span>
                </div>
              </div>
              <div className="instructions">
                <p>Asking questions as <strong>{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name}</strong>.</p>
                <div className="divider" />
                <p className="hint">If the AI is busy, try switching to a <strong>Flash</strong> model for faster response.</p>
              </div>
            </div>

            <div className="chat-container">
              <div className="messages-list">
                <AnimatePresence mode="popLayout">
                  {messages.map((msg, i) => (
                    <motion.div 
                      key={i}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`message-bubble ${msg.role} ${msg.isError ? 'error' : ''}`}
                    >
                      {msg.image && (
                        <div className="message-image">
                          <img src={msg.image} alt="User upload" />
                        </div>
                      )}
                      <div className="message-text">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                      
                      {msg.isError && (
                        <div className="error-actions">
                          <button 
                            className="btn-retry" 
                            onClick={() => {
                              if (lastAttempt) {
                                handleSendMessage(lastAttempt);
                              }
                            }}
                          >
                            <RefreshCw size={14} />
                            Retry Now
                          </button>
                          <button 
                            className="btn-switch" 
                            onClick={() => setShowModelSelector(true)}
                          >
                            <ChevronDown size={14} />
                            Switch Model
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {isThinking && (
                    <motion.div 
                      key="thinking"
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
                    placeholder="Type your question..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                  />
                  <button 
                    className="btn-send" 
                    onClick={() => handleSendMessage()}
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

      {error && !error.type && (
        <div className="error-toast glass">
          <div className="error-content">
            <AlertCircle color="var(--danger)" size={20} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
}

export default App;
