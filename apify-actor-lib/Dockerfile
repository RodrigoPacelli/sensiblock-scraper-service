# Use the Apify base image with Node.js and Playwright
FROM apify/actor-node-playwright:18

# Copy package files
COPY package*.json ./

# Install NPM packages
RUN npm ci --only=production

# Copy source code
COPY . ./

# Install Playwright browsers
RUN npx playwright install chromium

# Run the Actor
CMD npm start