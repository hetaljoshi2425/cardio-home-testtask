# Additional Notes

## Optimization Points

1. **Improve API Structure**:

   - Consider creating a more organized structure by adding dedicated controllers for specific APIs and related routes. For example, you can create separate controllers for `admin/best-profession` and `admin/best-client`.

2. **Models Folder**:

   - Create a `models` folder and include an `index.js` file that automatically imports and manages all models. This will help streamline model management and improve code organization.

3. **Testing with Swagger and Postman**:
   - **Swagger**:
     - To test APIs using Swagger, start the project and navigate to `http://localhost:3001/api-docs` in your web browser. This will display the Swagger documentation where you can interact with the API endpoints.
   - **Postman Collection**:
     - A Postman collection has been added to the repository for API testing. Import the collection into Postman to test all APIs. This will allow you to execute requests and view responses as defined in the collection.
