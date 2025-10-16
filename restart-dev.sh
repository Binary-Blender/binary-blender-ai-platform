#!/bin/bash

echo "🧹 Cleaning up old development servers..."

echo "Killing all Node.js processes..."
pkill -9 node 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null

echo "Waiting for processes to terminate..."
sleep 3

echo "Removing .next cache directory..."
rm -rf .next

echo "Verifying all processes are killed..."
sleep 2

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "🚀 Starting fresh development server..."
echo ""

npm run dev
