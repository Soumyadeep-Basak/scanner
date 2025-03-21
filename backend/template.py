import dropbox
from dropbox.file_properties import PropertyFieldTemplate, PropertyType
from dropbox.exceptions import ApiError
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Dropbox client
DROPBOX_ACCESS_TOKEN = os.getenv("DROPBOX_ACCESS_TOKEN")
dbx = dropbox.Dropbox(DROPBOX_ACCESS_TOKEN)

try:
    # Create the property template
    template = dbx.file_properties_templates_add_for_user(
        name="User Metadata",
        description="Metadata for user identification",
        fields=[
            PropertyFieldTemplate(
                name="user_email",
                description="Email of the user who uploaded the file",
                type=PropertyType.string
            )
        ]
    )
    print("Template created successfully!")
    print("Template ID:", template.template_id)
except ApiError as e:
    print(f"Failed to create template: {e}")