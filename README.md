# Task App Backend

This repository contains the backend for the Task App project. It provides APIs for task management including creating, updating, deleting, and listing tasks.

## Setup

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Run migrations (if using a database):

   ```bash
   python manage.py migrate
   ```

3. Start the development server:

   ```bash
   python manage.py runserver
   ```

## Deployment

- Ensure environment variables are set (e.g., `DATABASE_URL`, `SECRET_KEY`).
- Use a WSGI server like Gunicorn or uWSGI.
- Configure static and media file handling.
- Optionally, use Docker for containerization.

## License

MIT License