FROM nginx:alpine

# Copy the custom Nginx configuration
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"] 