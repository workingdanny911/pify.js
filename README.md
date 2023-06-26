# Pify.js

Pify.js is a TypeScript library that provides a powerful abstraction for building and managing asynchronous pipelines. The library supports complex operations with various types of payloads and can manage forwarding and replying functions as part of the pipeline. It is designed with type safety in mind, ensuring strict adherence to data types during pipeline operation.

## Features

-   **Type Safety**: Thanks to TypeScript, Pify.js ensures type safety across the pipeline, from the input data through each operation to the final output.

-   **Flexible Pipelines**: Define pipelines using `PipeFunction` and `Pipe` objects, allowing for complex, multi-step asynchronous operations.

-   **Extendibility**: Pipelines can be extended with `PipeLike` objects or functions, supporting modularity and code reuse.

-   **Subscriptions**: Provides support for subscribing functions to the pipeline, useful for side-effects or additional processing.

---

## Usage

In Pify.js, you can handle operations using `PipeFunction` and `Pipe`. This allows you to perform complex, multi-step asynchronous operations.

Here's a basic overview of how you could use Pify.js:

### 1. Importing the Module

First, import the `Pipe` module from the Pify.js library:

```typescript
import { Pipe } from 'pifyjs';
```

### 2. Creating a Pipeline

Use the `Pipe` class to create a new pipeline. A pipeline represents a series of operations that process input data.

```typescript
let pipeline = new Pipe();
```

### 3. Extending the Pipeline

Extend the pipeline with a `PipeFunction` or `Pipe` to specify the operations that should be performed on the input data. `PipeFunction` is a function that takes a payload and a control object as arguments, where:

-   `payload` is the data being processed in the pipeline.
-   `control` is an object with two methods: `forward` and `reply`.

```typescript
pipeline = pipeline.extend(async (payload, { forward, reply }) => {
    // process payload
    let result = someAsyncOperation(payload);

    forward(result);
});
```

The `forward` function is used to pass the result to the next function in the pipeline. The `reply` function is used to send a final result and terminate the pipeline.

### 4. Sending Data Through the Pipeline

Use the `send` method to send data through the pipeline:

```typescript
pipeline.send(data);
```

### 5. Subscribing to the Pipeline

Use the `subscribe` method to subscribe a function to the pipeline. This function will be called every time data is forwarded in the pipeline.

```typescript
pipeline.subscribe((result) => {
    console.log(`Data has been forwarded: ${result}`);
});
```

### 6. Creating Forwarding and Replying Pipelines

Pify.js also provides helper methods for creating pipelines that just forward or reply:

```typescript
let forwardingPipeline = Pipe.forwardingPipe((payload) => payload * 2);
let replyingPipeline = Pipe.replyingPipe((payload) => `Result: ${payload}`);
```

### 7. Combining Pipelines

You can use the `extend` method to combine pipelines:

```typescript
let combinedPipeline = pipeline.extend(forwardingPipeline).extend(replyingPipeline);
```

### 8. Cloning Pipelines

Pipelines can be cloned using the `clone` method. This is useful if you want to extend a pipeline but keep the original intact:

```typescript
let clonedPipeline = pipeline.clone();
```

### 9. Routing Pipelines

You can route the output of one pipeline to the input of another pipeline using the `routeTo` method:

```typescript
pipeline.routeTo(anotherPipeline);
```

The `routeTo` method automatically subscribes to the source pipeline and sends all forwarded data to the target pipeline.

---

The `Pify.js` library is designed to simplify managing complex asynchronous flows in JavaScript. It allows you to create a pipeline of operations, where each operation is a standalone, pluggable module that performs a specific task on data and forwards it to the next module in the pipeline. Here's an example scenario.

### Scenario: User Data Processing

Let's say you have an application that fetches user data from an API, transforms the data, and then stores the result in a database.

First, import the `Pipe` from the library:

```javascript
import { Pipe } from 'Pify.js';
```

Create the pipeline:

```typescript
type UserId = string;

const userProcessingPipeline = new Pipe<UserId>();
```

Now, define the individual steps or "Pipes" of the operation:

```typescript
interface RemoteUserData {}

interface TransformedUserData {}

interface StoredUserData {}

const fetchUserData = Pipe.forwardingPipe<UserId, RemoteUserData>(async (userID) => {
    const response = await fetch(`https://api.example.com/users/${userID}`);
    return (await response.json()) as RemoteUserData;
});

const transformUserData = Pipe.forwardingPipe<RemoteUserData, TransformedUserData>((userData) => {
    const transformedData = transform(userData);
    return transformedData;
});

const storeUserData = Pipe.replyingPipe<TransformedUserData, StoredUserData>(async (userData) => {
    const storedUser = await storeInDatabase(userData);
    return storedUser;
});
```

Each of these functions are standalone, pluggable modules that can be added to the pipeline using the `extend` method:

```typescript
userProcessingPipeline.extend(fetchUserData).extend(transformUserData).extend(storeUserData);
```

Here's where the pluggability comes into play. If you want to add an additional transformation or even remove the existing transformation, it's as simple as adding or removing a pipe from the pipeline:

```typescript
// Adding a new transformation
const additionalTransformation = Pipe.forwardingPipe((userData) => {
    // Perform some additional transformations
    return userData;
});

userProcessingPipeline
    .extend(fetchUserData)
    .extend(transformUserData)
    .extend(additionalTransformation) // new transformation added
    .extend(storeUserData);

// Removing a transformation
userProcessingPipeline
    .extend(fetchUserData)
    // .extend(transformUserData) // transformation removed
    .extend(storeUserData);
```

You can also easily replace a pipe:

```typescript
// Replacing a transformation
const newTransformation = Pipe.forwardingPipe((userData) => {
    // Perform some new transformations
    return userData;
});

userProcessingPipeline
    .extend(fetchUserData)
    .extend(newTransformation) // old transformation replaced
    .extend(storeUserData);
```

Finally, you can send data through the pipeline:

```typescript
const storedUserData = await userProcessingPipeline.send('12345'); // Where '12345' is the ID of the user
```

The data will pass through each of the 'Pipes' in the pipeline in the order they were added. The final pipe will store the transformed data and return a result, which is the final result of the pipeline.

This pluggable design makes it extremely easy to build complex data processing flows, where each step can be tested, replaced, or extended independently. This offers a great deal of flexibility in developing, maintaining, and scaling your application's data processing capabilities.

### Scenario: Collaborating Pipelines

Let's say we have a new requirement: after the user data is stored in the database, we need to send an email notification to the user. We'll define a new pipeline for this email sending process. We can then make this pipeline collaborate with the existing user data processing pipeline.

First, define the email sending pipeline:

```typescript
type EmailData = { email: string; subject: string; body: string };

const emailSendingPipeline = new Pipe<EmailData>();

const sendEmail = Pipe.forwardingPipe<EmailData, void>(async (emailData) => {
    // Assume we have a function to send email
    await sendEmail(emailData.email, emailData.subject, emailData.body);
});

emailSendingPipeline.extend(sendEmail);
```

Now, we can connect these two pipelines using the `routeTo` method. Let's modify the user data processing pipeline to generate the email data and forward it to the email sending pipeline:

```typescript
const generateEmailDataForUserUpdates = Pipe.forwardingPipe<StoredUserData, EmailData>((storedUserData) => {
    // Generate email data based on the stored user data
    const emailData = {
        email: storedUserData.email,
        subject: 'User Data Update',
        body: `Your data has been updated at ${new Date().toLocaleString()}.`,
    };
    return emailData;
});

userProcessingPipeline
    .routeTo(generateEmailDataForUserUpdates) // route the stored user data to the email data generation pipeline
    .routeTo(emailSendingPipeline); // route the email data to the email sending pipeline
```

By using the `routeTo` method, we forward the result of the user data processing pipeline to the email sending pipeline. The two pipelines are now collaborating. When you send a user ID through the user data processing pipeline, it will process the user data, store it in the database, generate the email data, and forward it to the email sending pipeline, which will then send an email notification to the user.

In addition, let's subscribe to the email sending pipeline using the `subscribe` method to log a message every time an email is sent:

```typescript
emailSendingPipeline.subscribe((emailData) => {
    console.log(`Email has been sent to ${emailData.email} with subject "${emailData.subject}"`);
});
```

The subscription will log a message every time an email is sent. The `Pify.js` library allows you to add as many subscriptions as you want, giving you the ability to react to the results of the pipeline in a variety of ways.

Now, send data through the user data processing pipeline:

```typescript
userProcessingPipeline.send('12345'); // Where '12345' is the ID of the user
```

This will trigger all the pipelines and you will see the logging output for the email that has been sent.

With the `Pify.js` library, you can create complex, collaborating asynchronous data flows with ease. Its pluggable and extendable design and the ability to subscribe to pipeline results offer a high degree of flexibility and control.
