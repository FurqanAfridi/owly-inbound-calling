# Knowledge Base Storage Bucket Setup

## Create Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. Click **New Bucket**
3. Configure:
   - **Name**: `agent-documents`
   - **Public**: ✅ Yes (for document access) OR ❌ No (private, use signed URLs)
   - **File size limit**: 50MB (or as needed)
   - **Allowed MIME types**: `application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document`
4. Click **Create Bucket**

## Storage Policies (RLS)

Go to **Storage** → Select `agent-documents` bucket → **Policies** tab

### Policy 1: Allow Authenticated Users to Upload
- **Policy name**: `Authenticated users can upload documents`
- **Allowed operation**: **INSERT**
- **Policy definition**:
```sql
(bucket_id = 'agent-documents' AND auth.role() = 'authenticated')
```

### Policy 2: Allow Users to Read Their Documents
- **Policy name**: `Users can read their documents`
- **Allowed operation**: **SELECT**
- **Policy definition**:
```sql
(bucket_id = 'agent-documents' AND auth.role() = 'authenticated')
```

### Policy 3: Allow Users to Delete Their Documents
- **Policy name**: `Users can delete their documents`
- **Allowed operation**: **DELETE**
- **Policy definition**:
```sql
(bucket_id = 'agent-documents' AND auth.role() = 'authenticated')
```

## Alternative: More Restrictive Policies (User-Specific)

If you want users to only access their own documents:

### INSERT Policy:
```sql
(bucket_id = 'agent-documents' 
 AND auth.uid()::text = (string_to_array(name, '/'))[1])
```

This assumes file path format: `{user_id}/{filename}` or `{kb_id}/{filename}`

### SELECT Policy:
```sql
(bucket_id = 'agent-documents' 
 AND auth.uid()::text = (string_to_array(name, '/'))[1])
```

### DELETE Policy:
```sql
(bucket_id = 'agent-documents' 
 AND auth.uid()::text = (string_to_array(name, '/'))[1])
```

## Testing

After creating the bucket and policies:
1. Try uploading a document in the Knowledge Bases page
2. If it fails, check the browser console for detailed error messages
3. Verify the bucket exists and policies are active
