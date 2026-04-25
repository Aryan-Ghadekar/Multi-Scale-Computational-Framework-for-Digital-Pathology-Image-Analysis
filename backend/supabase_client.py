import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class SupabaseClient:
    _instance: Client = None
    
    @classmethod
    def get_client(cls) -> Client:
        if cls._instance is None:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_KEY")
            
            if not url or not key:
                raise ValueError("Supabase URL and Key must be set in environment variables")
            
            url = url.rstrip('/')
            print(f"🔌 Connecting to Supabase at: {url}")
            
            cls._instance = create_client(url, key)
            print("✅ Supabase connected successfully")
        
        return cls._instance

# Create singleton instance
supabase = SupabaseClient.get_client()