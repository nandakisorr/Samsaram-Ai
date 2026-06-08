import React from 'react';

/**
 * ChatConfirmation component
 * - Prefixed IDs: chat-confirmation-container, chat-confirmation-message, chat-confirmation-button
 * - Emotionally expressive yet professional tone
 * - Event-driven: no setInterval/timeout; uses onClick and state
 */
export const ChatConfirmation: React.FC = () => {
  const [isConfirmed, setIsConfirmed] = React.useState(false);

  return (
    <div id="chat-confirmation-container" className="p-6 max-w-md mx-auto">
      {!isConfirmed ? (
        <>
          <p id="chat-confirmation-message" className="text-lg text-slate-700 mb-4">
            Your message is ready to be sent. Ready to send your thoughtful message – confirm to proceed?
          </p>
          <button
            id="chat-confirmation-button"
            onClick={() => setIsConfirmed(true)}
            className="hms-bg-primary hms-text-on-primary px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Confirm and Send
          </button>
        </>
      ) : (
        <div className="hms-bg-success hms-text-on-success p-4 rounded shadow-sm">
          <p id="chat-confirmation-success" className="text-base">
            Message sent successfully! Your thoughtful words are on their way.
          </p>
        </div>
      )}
    </div>
  );
};
