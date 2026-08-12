const connection = new signalR.HubConnectionBuilder()
    .withUrl("/chathub") // Replace with your SignalR hub URL
    .build();

connection.start().catch(err => console.error(err.toString()));

async function deleteMessage(messageId) {
    try {
        await connection.invoke("DeleteMessage", messageId);
    } catch (err) {
        console.error(err.toString());
    }
}

connection.on("MessageDeleted", (messageId) => {
    // Logic to remove the message from the UI
    console.log(`Message with ID ${messageId} has been deleted.`);
    // Here you would implement code to actually remove the message from the chat UI
});
