#!/bin/bash

# Exit on error
set -e

# Get the directory of the script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "Installing frontend dependencies..."
cd frontend
npm install

echo "Building frontend for production..."
# Set the API URL to /api so it uses the same host as the frontend
echo "VITE_API_URL=/api" > .env.production
npm run build
cd ..

echo "Frontend built successfully in frontend/dist"

