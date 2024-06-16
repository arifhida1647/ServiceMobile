## README: Project FULUS Backend

### Description
This repository contains the backend implementation for the FULUS application using Express.js.

### Prerequisites
- Node.js installed on your machine. You can download it from [nodejs.org](https://nodejs.org/).

### Getting Started
Follow these steps to get the project up and running on your local machine:

1. **Clone or Download the Repository**
   - Clone the repository using Git:
     ```
     git clone <repo-url>
     ```
   - Or download the repository as a zip file and extract it.

2. **Navigate to the Project Directory**
   - Open a terminal or command prompt and change directory to the project folder:
     ```
     cd path/to/project-folder
     ```

3. **Set Up Environment Variables**
   - Rename the `.env.example` file to `.env`.
   - Modify the `.env` file to match your required environment configurations (e.g., Firebase credentials).

4. **Install Dependencies**
   - Install the required npm packages:
     ```
     npm install
     ```

5. **Run the Application**
   - Start the server by running:
     ```
     node index.js
     ```

6. **Testing the Application**
   - Once the server is running, you can make GET requests to `http://localhost:3000` to interact with the application.

### Additional Notes
- Ensure all dependencies are correctly installed before running the application.
- Make sure your environment variables (especially for Firebase) are correctly configured to avoid runtime errors.
