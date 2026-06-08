// app.js

// ---------- WEBHOOK CONFIGURATION ----------
const WEBHOOK_URL = "https://ayman1232.app.n8n.cloud/webhook/2137b624-0899-4f0c-93a5-b0fd494d40c5";

// DOM Elements - Main AI Card
const chatContainer = document.querySelector(".chat-container");
const chatBoxQuery = document.getElementById("chatBoxQuery");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const clearChatBtn = document.getElementById("clearChatBtn");

// DOM Elements - Tab switches
const queryModeBtn = document.getElementById("queryModeBtn");
const imageModeBtn = document.getElementById("imageModeBtn");
const modeSwitch = document.getElementById("modeSwitch");
const modeBadge = document.getElementById("modeBadge");
const modeSubHint = document.getElementById("modeSubHint");

// DOM Elements - Image Generator
const imageGenContainer = document.getElementById("imageGenContainer");
const imageSupportForm = document.getElementById("imageSupportForm");
const imagePromptInput = document.getElementById("imagePromptInput");
const generateImageBtn = document.getElementById("generateImageBtn");
const imagePreviewArea = document.getElementById("imagePreviewArea");
const imagePreviewPlaceholder = document.getElementById("imagePreviewPlaceholder");
const generatedImageResult = document.getElementById("generatedImageResult");

// DOM Elements - Floating Support Drawer & Form
const floatingChatBubble = document.getElementById("floatingChatBubble");
const floatingChatWidget = document.getElementById("floatingChatWidget");
const closeWidgetBtn = document.getElementById("closeWidgetBtn");
const emailFormContainer = document.getElementById("emailFormContainer");

// State Variables
let currentMode = "query"; // 'query' or 'image'
let isQueryLoading = false;
let isImageGenerating = false;
let isEmailSubmitting = false;

let queryAbortController = null;

// Cache the original email support form markup to restore on reset
const originalEmailFormHTML = emailFormContainer.innerHTML;

// Premium Cyberpunk Art Mockups for Image Generation Simulation
const MOCK_IMAGES = [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80", // Purple abstract digital art
    "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80", // Cyberpunk street neon
    "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=600&q=80", // Neon space astronaut
    "https://images.unsplash.com/photo-1617791160505-6f006e121980?auto=format&fit=crop&w=600&q=80"  // Cyberpunk futuristic orb
];

// ---------- Markdown Parser ----------
function parseMarkdown(text) {
    if (!text) return "";

    // Escape HTML to prevent XSS
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Convert Code Blocks: ```code```
    html = html.replace(/```([\s\S]+?)```/g, (match, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Convert Inline Code: `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert Bold: **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Convert Bullet Lists
    const lines = html.split('\n');
    let inList = false;
    const processedLines = [];

    for (let line of lines) {
        const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
        if (bulletMatch) {
            if (!inList) {
                processedLines.push('<ul>');
                inList = true;
            }
            processedLines.push(`<li>${bulletMatch[2]}</li>`);
        } else {
            if (inList) {
                processedLines.push('</ul>');
                inList = false;
            }
            processedLines.push(line);
        }
    }
    if (inList) {
        processedLines.push('</ul>');
    }
    html = processedLines.join('\n');

    // Convert raw URLs to links
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    html = html.replace(urlRegex, (url) => {
        let cleanUrl = url;
        let suffix = "";
        const lastChar = url.slice(-1);
        if (['.', ',', '!', ';', ')', ']'].includes(lastChar)) {
            cleanUrl = url.slice(0, -1);
            suffix = lastChar;
        }
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${suffix}`;
    });

    // Convert remaining newlines (not inside lists/pre) to breaks
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/<\/li><br>/g, '</li>');
    html = html.replace(/<ul><br>/g, '<ul>');
    html = html.replace(/<\/ul><br>/g, '</ul>');
    html = html.replace(/<pre><br>/g, '<pre>');
    html = html.replace(/<\/pre><br>/g, '</pre>');

    return html;
}

// ---------- Chat Utilities ----------
function addMessage(container, text, type, isError = false, isHtml = false) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", type);
    
    if (isError) msgDiv.classList.add("error-message");
    
    if (isHtml) {
        msgDiv.innerHTML = text;
    } else {
        msgDiv.textContent = text;
    }
    
    container.appendChild(msgDiv);
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    return msgDiv;
}

function removeTypingIndicator(container) {
    const existingTyping = container.querySelector(".typing-indicator");
    if (existingTyping) existingTyping.remove();
}

function showTypingIndicator(container) {
    removeTypingIndicator(container);
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("typing-indicator");
    typingDiv.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
    container.appendChild(typingDiv);
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    return typingDiv;
}

// ---------- Loader Controllers ----------
function setQueryLoading(loading) {
    isQueryLoading = loading;
    sendBtn.disabled = loading;
    messageInput.disabled = loading;
    if (loading) {
        messageInput.style.opacity = "0.6";
    } else {
        messageInput.style.opacity = "1";
        messageInput.focus();
    }
}

function setImageGenerating(generating) {
    isImageGenerating = generating;
    generateImageBtn.disabled = generating;
    imagePromptInput.disabled = generating;
    if (generating) {
        imagePromptInput.style.opacity = "0.6";
    } else {
        imagePromptInput.style.opacity = "1";
        imagePromptInput.focus();
    }
}

// Tab Mode Controller
function setMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    if (currentMode === "query") {
        queryModeBtn.classList.add("active");
        imageModeBtn.classList.remove("active");
        modeSwitch.classList.remove("image-active");
        chatContainer.classList.remove("image-mode-active");
        modeBadge.innerText = "⚡ AI Assistant active";
        modeSubHint.innerText = "Instant smart replies • knowledge base";
        
        setTimeout(() => {
            messageInput.focus();
            chatBoxQuery.scrollTo({ top: chatBoxQuery.scrollHeight, behavior: "smooth" });
        }, 150);
    } else {
        imageModeBtn.classList.add("active");
        queryModeBtn.classList.remove("active");
        modeSwitch.classList.add("image-active");
        chatContainer.classList.add("image-mode-active");
        modeBadge.innerText = "🎨 Image Generator active";
        modeSubHint.innerText = "Create stunning illustrations using AI prompts";
        
        setTimeout(() => {
            imagePromptInput.focus();
        }, 150);
    }
}

// Reset AI Chat log
function resetQueryConversation() {
    if (queryAbortController) {
        queryAbortController.abort();
        queryAbortController = null;
    }
    
    chatBoxQuery.innerHTML = "";
    removeTypingIndicator(chatBoxQuery);
    if (isQueryLoading) setQueryLoading(false);

    const welcomeMsg = "🌟 Hello! I'm your My Country Mobile AI specialist. I can assist with VoIP, cloud communication, international routing, and platform insights. How can I help?";
    addMessage(chatBoxQuery, welcomeMsg, "ai");
    messageInput.focus();
}

// ---------- Operations / Webhook Dispatchers ----------

// 1. AI Text Chat Message sender
async function sendQueryMessage() {
    const rawMessage = messageInput.value.trim();
    if (!rawMessage || isQueryLoading) return;

    if (queryAbortController) {
        queryAbortController.abort();
        queryAbortController = null;
    }

    addMessage(chatBoxQuery, rawMessage, "user");
    messageInput.value = "";

    setQueryLoading(true);
    showTypingIndicator(chatBoxQuery);

    const controller = new AbortController();
    queryAbortController = controller;

    try {
        const payload = {
            type: "query",
            message: rawMessage
        };

        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!chatBoxQuery.isConnected || controller.signal.aborted) return;

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const textResponse = await response.text();
            data = { output: textResponse || "Response received, but format unexpected." };
        }

        removeTypingIndicator(chatBoxQuery);

        let replyText = "✅ Request processed successfully.";
        if (data) {
            if (Array.isArray(data) && data.length > 0) {
                if (data[0].output) replyText = data[0].output;
                else if (data[0].message) replyText = data[0].message;
                else replyText = JSON.stringify(data[0]);
            } else if (data.output) {
                replyText = data.output;
            } else if (data.message) {
                replyText = data.message;
            } else if (data.text) {
                replyText = data.text;
            } else if (typeof data === "string") {
                replyText = data;
            } else {
                replyText = data.reply || data.content || "Thank you. Your message has been recorded.";
            }
        }

        if (!replyText || replyText.trim() === "") {
            replyText = "I am here to assist you! Could you please clarify your request?";
        }

        addMessage(chatBoxQuery, parseMarkdown(replyText), "ai", false, true);

    } catch (error) {
        if (error.name === "AbortError") return;
        
        removeTypingIndicator(chatBoxQuery);
        let errorMsg = "⚠️ Unable to connect to support service. Please check your network or try again.";
        if (error.message.includes("HTTP")) {
            errorMsg = `⚠️ Service temporarily unavailable (${error.message}). Our operations team has been notified.`;
        } else {
            errorMsg = `⚠️ Error: ${error.message}. Please reload the workspace.`;
        }
        addMessage(chatBoxQuery, errorMsg, "ai", true);
    } finally {
        if (queryAbortController === controller) queryAbortController = null;
        setQueryLoading(false);
        removeTypingIndicator(chatBoxQuery);
        messageInput.focus();
    }
}

// 2. AI Image Generator submission
async function handleImageFormSubmit(event) {
    event.preventDefault();
    if (isImageGenerating) return;

    const promptText = imagePromptInput.value.trim();
    if (!promptText) return;

    setImageGenerating(true);

    // Reset preview area
    imagePreviewPlaceholder.style.display = "none";
    generatedImageResult.style.display = "none";
    generatedImageResult.classList.remove("fade-in-img");
    generatedImageResult.src = "";

    // Clear any previous error
    const existingError = document.getElementById("imageGenError");
    if (existingError) existingError.remove();

    // Show skeleton loader
    const skeletonDiv = document.createElement("div");
    skeletonDiv.className = "skeleton-preview";
    skeletonDiv.id = "imageGenSkeleton";
    skeletonDiv.innerHTML = `
        <div class="skeleton-canvas"></div>
        <div class="skeleton-bar"></div>
        <div class="skeleton-text">Generating your image... 🎨</div>
    `;
    imagePreviewArea.appendChild(skeletonDiv);

    try {
        const payload = { type: "image", prompt: promptText };

        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(payload)
        });

        // Remove skeleton
        const skeleton = document.getElementById("imageGenSkeleton");
        if (skeleton) skeleton.remove();

        if (!response.ok) {
            throw new Error(`Server error ${response.status}: ${response.statusText}`);
        }

        let data;
        try {
            data = await response.json();
        } catch {
            throw new Error("n8n returned a non-JSON response. Check your Respond to Webhook node is set to return JSON.");
        }

        // Unwrap n8n array wrapper — n8n always wraps output in an array
        if (Array.isArray(data)) data = data[0];

        // Log the full response to console so you can inspect it
        console.log("n8n image response:", JSON.stringify(data, null, 2));

        // Deep-search for base64 — covers every possible n8n output structure:
        // { imageBase64 } | { base64 } | { artifacts:[{base64}] } | { data:[{b64_json}] } | { image } | { url }
        let raw =
            data?.imageBase64                   ||
            data?.base64                        ||
            data?.artifacts?.[0]?.base64        ||
            data?.data?.[0]?.b64_json           ||
            data?.image                         ||
            data?.imageUrl                      ||
            data?.url                           ||
            null;

        // If still null, try one level deeper (some n8n nodes double-wrap)
        if (!raw && data?.json) {
            const inner = data.json;
            raw =
                inner?.imageBase64              ||
                inner?.base64                   ||
                inner?.artifacts?.[0]?.base64   ||
                inner?.image                    ||
                inner?.imageUrl                 ||
                inner?.url                      ||
                null;
        }

        if (!raw) {
            // Print the actual keys received to help debug
            const keys = JSON.stringify(Object.keys(data || {}));
            throw new Error(
                `Image data not found. n8n returned keys: ${keys}. ` +
                "Add a Code node returning: { imageBase64: $input.first().json.artifacts[0].base64 }"
            );
        }

        // Sanitise — strip whitespace/newlines that corrupt base64
        if (typeof raw === "string" && !raw.startsWith("http") && !raw.startsWith("data:")) {
            raw = raw.replace(/\s+/g, "");
        }

        // Build final src
        let imgSrc;
        if (typeof raw === "string" && (raw.startsWith("http://") || raw.startsWith("https://"))) {
            imgSrc = raw;
        } else if (typeof raw === "string" && raw.startsWith("data:")) {
            imgSrc = raw;
        } else {
            // Plain base64 — NVIDIA FLUX returns JPEG
            imgSrc = "data:image/jpeg;base64," + raw;
        }

        // Validate it actually loads before showing
        await new Promise((resolve, reject) => {
            const testImg = new Image();
            testImg.onload = resolve;
            testImg.onerror = () => reject(new Error(
                "Base64 decoded but image failed to render. " +
                "The base64 string from NVIDIA may be corrupted. Check the Code node output in n8n."
            ));
            testImg.src = imgSrc;
        });

        generatedImageResult.src = imgSrc;
        generatedImageResult.style.display = "block";
        generatedImageResult.classList.add("fade-in-img");

    } catch (error) {
        console.error("Image generation error:", error);

        const skeleton = document.getElementById("imageGenSkeleton");
        if (skeleton) skeleton.remove();

        // Inline error panel — no alert()
        const errorDiv = document.createElement("div");
        errorDiv.id = "imageGenError";
        errorDiv.className = "image-gen-error";
        errorDiv.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p class="image-gen-error-title">Generation Failed</p>
            <p class="image-gen-error-msg">${error.message}</p>
            <button class="image-gen-retry-btn" id="imageGenRetryBtn">Try Again</button>
        `;
        imagePreviewArea.appendChild(errorDiv);

        document.getElementById("imageGenRetryBtn").addEventListener("click", () => {
            errorDiv.remove();
            imagePreviewPlaceholder.style.display = "flex";
        });
    } finally {
        setImageGenerating(false);
    }
}

// 3. Email Support Ticket form submission
async function handleEmailFormSubmit(event) {
    event.preventDefault();
    if (isEmailSubmitting) return;

    const emailName = document.getElementById("emailName");
    const emailAddress = document.getElementById("emailAddress");
    const emailSubject = document.getElementById("emailSubject");
    const emailMessage = document.getElementById("emailMessage");
    const submitBtn = document.getElementById("submitEmailBtn");

    const name = emailName.value.trim();
    const email = emailAddress.value.trim();
    const subject = emailSubject.value.trim();
    const message = emailMessage.value.trim();

    if (!name || !email || !subject || !message) return;

    isEmailSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Submitting...</span>`;

    try {
        const payload = {
            type: "email",
            name: name,
            email: email,
            subject: subject,
            message: message
        };

        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Render success checkmark feedback panel
        emailFormContainer.innerHTML = `
            <div class="email-success-container">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <h3>Ticket Logged Successfully</h3>
                <p>Confirmation has been dispatched to <strong>${email}</strong>. Our service desk will evaluate your ticket shortly.</p>
                <button class="reset-email-btn" id="resetEmailBtn">Log Another Ticket</button>
            </div>
        `;

        // Bind reset form click trigger
        document.getElementById("resetEmailBtn").addEventListener("click", restoreEmailForm);

    } catch (error) {
        alert(`⚠️ Ticket submission failure: ${error.message}`);
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Submit Ticket</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
    } finally {
        isEmailSubmitting = false;
    }
}

// Restore form input elements markup
function restoreEmailForm() {
    emailFormContainer.innerHTML = originalEmailFormHTML;
    
    // Rebind submit event listener
    const freshForm = document.getElementById("emailSupportForm");
    if (freshForm) {
        freshForm.addEventListener("submit", handleEmailFormSubmit);
    }
}

// ---------- Drawer Toggle Handlers ----------
function toggleFloatingDrawer() {
    const isActive = floatingChatWidget.classList.contains("active");
    
    if (isActive) {
        // Slide Down Drawer
        floatingChatWidget.classList.remove("active");
        floatingChatBubble.classList.remove("active");
    } else {
        // Slide Up Drawer
        floatingChatWidget.classList.add("active");
        floatingChatBubble.classList.add("active");
        
        const emailName = document.getElementById("emailName");
        if (emailName) emailName.focus();
    }
}

// ---------- Event Listeners ----------

// Central AI Chat input triggers
sendBtn.addEventListener("click", sendQueryMessage);
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isQueryLoading) {
        e.preventDefault();
        sendQueryMessage();
    }
});

// Clear conversation log
clearChatBtn.addEventListener("click", () => {
    if (currentMode === "query") {
        resetQueryConversation();
    } else {
        // Reset image generator
        imagePromptInput.value = "";
        generatedImageResult.style.display = "none";
        imagePreviewPlaceholder.style.display = "flex";
        imagePromptInput.focus();
    }
});

// Tab Switch events
queryModeBtn.addEventListener("click", () => {
    setMode("query");
});
imageModeBtn.addEventListener("click", () => {
    setMode("image");
});

// Image generator form trigger
if (imageSupportForm) {
    imageSupportForm.addEventListener("submit", handleImageFormSubmit);
}

// Drawer triggers
floatingChatBubble.addEventListener("click", toggleFloatingDrawer);
closeWidgetBtn.addEventListener("click", toggleFloatingDrawer);

// ---------- Initialization ----------
function init() {
    // Clear chat log initially
    chatBoxQuery.innerHTML = "";
    
    // Bind Email form submit
    const supportForm = document.getElementById("emailSupportForm");
    if (supportForm) {
        supportForm.addEventListener("submit", handleEmailFormSubmit);
    }
    
    // Initialize AI welcome greeting
    resetQueryConversation();
    
    // Default mode
    currentMode = "query";
    queryModeBtn.classList.add("active");
    imageModeBtn.classList.remove("active");
    modeSwitch.classList.remove("image-active");
    chatContainer.classList.remove("image-mode-active");
    
    messageInput.focus();
}

// Page load event
document.addEventListener("DOMContentLoaded", init);
if (document.readyState === "interactive" || document.readyState === "complete") {
    init();
}