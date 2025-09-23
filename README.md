# ZIA: Multi-Tenant Chatbot Backend

ZIA is a powerful, multi-tenant chatbot backend designed to provide intelligent, automated conversations across multiple platforms. Built with FastAPI, it integrates seamlessly with Meta (Facebook and Instagram), WhatsApp (via Twilio), and Stripe for payments, making it a comprehensive solution for businesses looking to enhance customer engagement and automate sales.

The platform is designed to be highly customizable for each tenant, allowing for unique branding, conversational flows, and business logic.

## Key Features

- **Multi-Tenant Architecture**: Securely manage multiple clients from a single deployment, with tenant-specific configurations, databases, and branding.
- **AI-Powered Conversations**: Leverages OpenAI's GPT models to provide natural and intelligent responses. System prompts can be dynamically customized for each tenant to match their brand's voice and policies.
- **Cross-Platform Integration**:
    - **Meta**: Responds to comments and direct messages on Facebook pages and Instagram accounts.
    - **WhatsApp**: Engages with customers through WhatsApp using the Twilio API.
    - **Web**: A customizable chat widget that can be embedded on any website.
- **Integrated Payments with Stripe**:
    - **Stripe Connect**: Onboard tenants with their own Stripe accounts for direct payment processing.
    - **Dynamic Checkouts**: Generate Stripe checkout links for subscriptions and one-time purchases.
    - **Multiple Channels**: Share payment links via chat, generate QR codes, or send them directly through WhatsApp.
- **Lead Generation Flow**: A built-in conversational flow to capture leads (name, email, WhatsApp) and save them to the database.
- **External Product Catalog**: Tenants can link an external product catalog (via URL), which the chatbot can use to answer questions and initiate purchases.
- **Admin & Analytics**:
    - Endpoints for managing tenants, viewing leads, and exporting data.
    - Event tracking for key user interactions.
- **Real-time & Asynchronous**: Provides real-time chat with streaming and handles asynchronous events from webhooks efficiently.

## Architecture and Tech Stack

The application is built around a modern Python backend, designed for scalability and asynchronous request handling.

- **Backend**: **FastAPI** provides the high-performance API framework.
- **Database**: **PostgreSQL** is used for data persistence, storing information about tenants, leads, and events. **SQLAlchemy** serves as the ORM for database interactions.
- **AI Engine**: **OpenAI API** is used for generating chat responses.
- **Integrations**:
    - **Twilio API**: For sending and receiving WhatsApp messages.
    - **Meta Graph API**: For interacting with Facebook and Instagram.
    - **Stripe API**: For handling payments, subscriptions, and Stripe Connect.
- **Deployment**: The application is container-friendly and can be deployed on any platform that supports Python ASGI applications. The `runtime.txt` suggests it's ready for PaaS providers like Heroku or Render.

A typical request flow for a web chat is as follows:
1. The user interacts with the chat widget on a tenant's website.
2. The frontend sends a request to the FastAPI backend.
3. The backend identifies the tenant, builds a dynamic prompt with the tenant's custom instructions and context, and sends it to the OpenAI API.
4. The response is streamed back to the user in real-time.
5. Events, such as messages and lead captures, are stored in the PostgreSQL database.

## Getting Started

### Prerequisites

- Python 3.9+
- PostgreSQL 12+
- An OpenAI API key
- Accounts for Twilio, Meta Developer, and Stripe (optional, for full functionality)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Create a virtual environment and install dependencies:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    pip install -r requirements.txt
    ```

3.  **Set up the database:**
    - Make sure you have a PostgreSQL server running.
    - Create a new database for the project.
    - The application will automatically create the necessary tables on startup.

4.  **Configure environment variables:**
    - Create a `.env` file in the root of the project.
    - Add the following variables to the file:

    ```env
    # Application Settings
    ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
    DATABASE_URL="postgresql://user:password@host:port/dbname"
    ADMIN_KEY="your-secret-admin-key"
    USE_MOCK="False" # Set to "True" to mock AI responses

    # OpenAI
    OPENAI_API_KEY="your-openai-api-key"
    OPENAI_MODEL="gpt-4o-mini"

    # Meta (Facebook/Instagram)
    META_VERIFY_TOKEN="your-meta-webhook-verify-token"

    # Twilio (for WhatsApp)
    TWILIO_ACCOUNT_SID="your-twilio-account-sid"
    TWILIO_AUTH_TOKEN="your-twilio-auth-token"
    TWILIO_WHATSAPP_FROM="whatsapp:+14155238886" # Your Twilio WhatsApp number

    # Stripe
    STRIPE_SECRET_KEY="your-stripe-secret-key"
    STRIPE_WEBHOOK_SECRET="your-stripe-webhook-secret"
    SITE_URL="http://localhost:8000"
    ```

### Running the Application

-   **Run the backend server:**
    ```bash
    uvicorn main:app --reload
    ```
    The API will be available at `http://localhost:8000`.

-   **Launch the demo chat widget:**
    Open the `index.html` file in your browser to interact with the chat widget.

## API Endpoints

### Chat

-   `POST /v1/chat/stream?tenant=<slug>`: The main endpoint for the web chat widget. It takes a message from the user and streams the AI's response back in real-time using Server-Sent Events (SSE).
-   `POST /v1/chat?tenant=<slug>`: A non-streaming version of the chat endpoint.

### Webhooks

-   `GET, POST /v1/meta/webhook`: Handles webhooks from the Meta platform. The `GET` request is for the initial verification challenge, and the `POST` request receives events like new messages and comments.
-   `POST /v1/twilio/whatsapp/webhook`: The endpoint for receiving incoming WhatsApp messages from Twilio.
-   `POST /v1/stripe/webhook`: Receives events from Stripe, such as `checkout.session.completed` and `invoice.paid`.

### Tenant & Catalog

-   `GET /v1/widget/bootstrap?tenant=<slug>`: Provides the initial configuration for the chat widget, including tenant details.
-   `GET /v1/catalog?tenant=<slug>`: Retrieves the external product catalog for a specific tenant.

### Payments

-   `POST /v1/stripe/checkout/by-plan?tenant=<slug>`: Creates a Stripe checkout session for a subscription plan.
-   `POST /v1/stripe/checkout/by-item?tenant=<slug>`: Creates a Stripe checkout session for a specific item from the catalog.
-   `POST /v1/stripe/checkout/qr?tenant=<slug>`: Generates a QR code for a checkout URL.
-   `POST /v1/stripe/checkout/send-wa?tenant=<slug>`: Creates a checkout link and sends it to a user via WhatsApp.

### Admin

The application includes several admin endpoints under `/v1/admin/` for managing tenants, leads, and diagnostics. These require an `x-api-key` header matching the `ADMIN_KEY` environment variable.

## Tenant and Integration Configuration

### Creating a Tenant

Tenants are managed through the `/v1/tenants` admin endpoint. To create or update a tenant, send a `POST` request with your admin key:

```bash
curl -X POST "http://localhost:8000/v1/tenants" \
-H "Content-Type: application/json" \
-H "x-api-key: your-secret-admin-key" \
-d '{
  "slug": "new-tenant",
  "name": "New Tenant Inc.",
  "whatsapp": "+15551234567",
  "settings": {
    "tone": "professional and helpful",
    "policies": "No refunds after 30 days.",
    "catalog_url": "https://example.com/products.json",
    "faq": [
      {"q": "What are your hours?", "a": "9am-5pm Mon-Fri"}
    ]
  }
}'
```

### Integration Setup

-   **Meta (Facebook/Instagram)**:
    1.  Set up a Meta Developer App and configure the Messenger and Instagram Graph API.
    2.  Add a webhook product and point it to `https://your-domain.com/v1/meta/webhook`.
    3.  Use the `META_VERIFY_TOKEN` from your `.env` file as the webhook verification token.
    4.  Store the Page ID, Page Access Token, and Instagram User ID in the tenant's `settings` in the database (`fb_page_id`, `fb_page_token`, `ig_user_id`).

-   **Twilio (WhatsApp)**:
    1.  Get your Account SID, Auth Token, and a Twilio WhatsApp number.
    2.  Set the `TWILIO_*` variables in your `.env` file.
    3.  For tenant-specific numbers, store them in the tenant's `settings` (`twilio_account_sid`, `twilio_auth_token`, `twilio_whatsapp_from`).
    4.  Configure the Twilio webhook for incoming messages to point to `https://your-domain.com/v1/twilio/whatsapp/webhook?tenant=<slug>`.

-   **Stripe**:
    1.  Set your global Stripe keys in the `.env` file.
    2.  To enable payments for a tenant, use the `/v1/admin/stripe/connect/onboard` endpoint to generate an onboarding link for the tenant to connect their own Stripe account.
    3.  The application will store the tenant's Stripe account ID in their settings.
    4.  Set up a webhook in your Stripe dashboard and point it to `https://your-domain.com/v1/stripe/webhook`, listening for the required events.
### Python 3.13 / macOS note (asyncpg build issues)

If you're on Python 3.13 and macOS, `asyncpg` may fail to build wheels. Two options:

- Recommended: use Python 3.12 (matches `runtime.txt`).
- Or use psycopg v3 binary wheels instead of asyncpg:

```bash
# Install psycopg variant of requirements
pip install -r requirements-psycopg.txt

# Set DB driver in your environment (or .env)
export DB_DRIVER=psycopg
# DATABASE_URL can be standard postgres://...; the app will adapt it.
```

When `DB_DRIVER=psycopg`, the backend uses SQLAlchemy with `psycopg` (async)
instead of `asyncpg`, avoiding compilation on Python 3.13.
