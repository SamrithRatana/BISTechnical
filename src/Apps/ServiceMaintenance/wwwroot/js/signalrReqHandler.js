var connection = new signalR.HubConnectionBuilder()
    .withUrl('/chathub')
    .build();

connection.on('receiveMessage', addMessageToChat);

connection.start()
    .catch(error => {
        console.error(error.message);
    });

function sendMessageToHub(message) {
    connection.invoke('SendMessage', message)
        .catch(err => console.error(err.toString()));
}
