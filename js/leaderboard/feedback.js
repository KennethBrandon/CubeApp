
export const FEEDBACK_ENDPOINT = "https://script.google.com/macros/s/AKfycbzbuImvlkZ-dyXOhZUwCzNp551RRKb7yJzb9qGAliZ1EobkJsXESIdgV7Io3o5Hd7NBBQ/exec";

export async function submitFeedback(message, email, category) {
    const data = {
        message: message,
        email: email,
        category: category,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
    };

    // Google Apps Script Web Apps don't easily support CORS with JSON content-type.
    // However, they handle text/plain or no-cors well.
    // We will use 'no-cors' which means we can't read the response, but the request will go through.

    try {
        await fetch(FEEDBACK_ENDPOINT, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain' // Avoids preflight OPTIONS request
            },
            body: JSON.stringify(data)
        });
        return true;
    } catch (error) {
        console.error("Feedback error:", error);
        return false;
    }
}
