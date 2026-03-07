/**
 * IndexedDB Service for Local Message Storage
 * =============================================
 * Handles local storage of messages with status tracking.
 * 
 * CRITICAL: Backend does NOT permanently store messages.
 * All messages are stored locally in IndexedDB.
 * 
 * Message Status Flow:
 * - 'pending' -> 'sent' (1 tick) -> 'delivered' (2 ticks) -> 'read' (blue ticks)
 */

const DB_NAME = 'collab_chat_db';
const DB_VERSION = 1;

// Store names
const STORES = {
    MESSAGES: 'messages',
    CONVERSATIONS: 'conversations',
    PENDING_ACK: 'pending_ack'
};

/**
 * Open IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create messages store with indexes
            if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
                const messageStore = db.createObjectStore(STORES.MESSAGES, {
                    keyPath: 'id'
                });
                // Indexes for efficient querying
                messageStore.createIndex('conversationId', 'conversationId', { unique: false });
                messageStore.createIndex('senderId', 'senderId', { unique: false });
                messageStore.createIndex('status', 'status', { unique: false });
                messageStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // Create conversations store
            if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
                const conversationStore = db.createObjectStore(STORES.CONVERSATIONS, {
                    keyPath: 'id'
                });
                conversationStore.createIndex('lastMessageTime', 'lastMessageTime', { unique: false });
            }

            // Create pending ACK store (messages waiting for server ACK)
            if (!db.objectStoreNames.contains(STORES.PENDING_ACK)) {
                const pendingStore = db.createObjectStore(STORES.PENDING_ACK, {
                    keyPath: 'localId'
                });
                pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
};

/**
 * Add or update a message in IndexedDB
 * @param {Object} message - Message object
 * @returns {Promise<void>}
 */
export const saveMessage = async (message) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.MESSAGES], 'readwrite');
        const store = transaction.objectStore(STORES.MESSAGES);

        // Add timestamp if not present
        const messageWithTimestamp = {
            ...message,
            timestamp: message.timestamp || new Date().toISOString(),
            // Ensure status is set
            status: message.status || 'pending'
        };

        const request = store.put(messageWithTimestamp);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Get all messages for a conversation
 * @param {string} conversationId - Conversation ID (project ID)
 * @returns {Promise<Array>}
 */
export const getMessages = async (conversationId) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.MESSAGES], 'readonly');
        const store = transaction.objectStore(STORES.MESSAGES);
        const index = store.index('conversationId');
        const request = index.getAll(IDBKeyRange.only(conversationId));

        request.onsuccess = () => {
            // Sort by timestamp
            const messages = request.result.sort((a, b) =>
                new Date(a.timestamp) - new Date(b.timestamp)
            );
            resolve(messages);
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Update message status
 * @param {string} messageId - Message ID
 * @param {string} status - New status ('sent', 'delivered', 'read')
 * @returns {Promise<void>}
 */
export const updateMessageStatus = async (messageId, status) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.MESSAGES], 'readwrite');
        const store = transaction.objectStore(STORES.MESSAGES);

        // First get the message
        const getRequest = store.get(messageId);

        getRequest.onsuccess = () => {
            const message = getRequest.result;
            if (message) {
                message.status = status;
                message.statusUpdatedAt = new Date().toISOString();

                const updateRequest = store.put(message);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                resolve(); // Message not found, ignore
            }
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
};

/**
 * Get message by ID
 * @param {string} messageId - Message ID
 * @returns {Promise<Object|null>}
 */
export const getMessageById = async (messageId) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.MESSAGES], 'readonly');
        const store = transaction.objectStore(STORES.MESSAGES);
        const request = store.get(messageId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Save message pending ACK (waiting for server acknowledgement)
 * @param {Object} message - Message with localId
 * @returns {Promise<void>}
 */
export const savePendingAck = async (message) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.PENDING_ACK], 'readwrite');
        const store = transaction.objectStore(STORES.PENDING_ACK);

        const request = store.put({
            localId: message.localId,
            message: message,
            timestamp: new Date().toISOString()
        });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Remove message from pending ACK
 * @param {string} localId - Local message ID
 * @returns {Promise<void>}
 */
export const removePendingAck = async (localId) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.PENDING_ACK], 'readwrite');
        const store = transaction.objectStore(STORES.PENDING_ACK);

        const request = store.delete(localId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Get all pending ACK messages
 * @returns {Promise<Array>}
 */
export const getPendingAckMessages = async () => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.PENDING_ACK], 'readonly');
        const store = transaction.objectStore(STORES.PENDING_ACK);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Save conversation metadata
 * @param {Object} conversation - Conversation object
 * @returns {Promise<void>}
 */
export const saveConversation = async (conversation) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.CONVERSATIONS], 'readwrite');
        const store = transaction.objectStore(STORES.CONVERSATIONS);

        const request = store.put({
            ...conversation,
            lastMessageTime: conversation.lastMessageTime || new Date().toISOString()
        });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Get all conversations
 * @returns {Promise<Array>}
 */
export const getConversations = async () => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.CONVERSATIONS], 'readonly');
        const store = transaction.objectStore(STORES.CONVERSATIONS);
        const request = store.getAll();

        request.onsuccess = () => {
            // Sort by last message time
            const conversations = request.result.sort((a, b) =>
                new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
            );
            resolve(conversations);
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Clear all data (for logout or testing)
 * @returns {Promise<void>}
 */
export const clearAllData = async () => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            [STORES.MESSAGES, STORES.CONVERSATIONS, STORES.PENDING_ACK],
            'readwrite'
        );

        transaction.objectStore(STORES.MESSAGES).clear();
        transaction.objectStore(STORES.CONVERSATIONS).clear();
        transaction.objectStore(STORES.PENDING_ACK).clear();

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

/**
 * Get messages after a specific timestamp (for sync)
 * @param {string} conversationId - Conversation ID
 * @param {string} afterTimestamp - ISO timestamp
 * @returns {Promise<Array>}
 */
export const getMessagesAfter = async (conversationId, afterTimestamp) => {
    const messages = await getMessages(conversationId);
    return messages.filter(m => new Date(m.timestamp) > new Date(afterTimestamp));
};

export default {
    saveMessage,
    getMessages,
    updateMessageStatus,
    getMessageById,
    savePendingAck,
    removePendingAck,
    getPendingAckMessages,
    saveConversation,
    getConversations,
    clearAllData,
    getMessagesAfter
};
