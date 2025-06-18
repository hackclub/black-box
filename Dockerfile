FROM emscripten/emsdk:latest

# Set the working directory
WORKDIR /app

# install arduino cli
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
# add to PATH
ENV PATH="/app/bin:$PATH"
# copy config file
COPY ./arduino-cli.yaml .
# install rp2040 core
RUN arduino-cli core update-index --config-file ./arduino-cli.yaml
RUN arduino-cli core install rp2040:rp2040 --config-file ./arduino-cli.yaml

# Copy package.json and package-lock.json first to leverage Docker caching
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose port 3000
EXPOSE 3000

# Set the command to start the application
CMD ["npm", "start"]
