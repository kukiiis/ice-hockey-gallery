// pages/admin/upload/[id].js
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import styles from '../../../styles/AdminUpload.module.css';

export default function AdminUpload() {
  const router = useRouter();
  const { id: galleryId } = router.query;
  const [gallery, setGallery] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      // Check if user is admin
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (error || !data || !data.is_admin) {
        router.push('/galleries');
        return;
      }
      setUser(session.user);
      fetchGallery();
    };

    if (galleryId) {
      checkAdmin();
    }
    // eslint-disable-next-line
  }, [galleryId]);

  const fetchGallery = async () => {
    const { data, error } = await supabase
      .from('galleries')
      .select('*')
      .eq('id', galleryId)
      .single();
    if (!error) setGallery(data);
  };

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files.length) return;
    setUploading(true);

    try {
      for (const file of files) {
        // Upload to Supabase Storage
        const filePath = `${galleryId}/${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage
          .from('photos')
          .upload(filePath, file);

        if (error) throw error;

        // Insert photo record into DB
        await supabase.from('photos').insert({
          gallery_id: galleryId,
          filename: file.name,
          storage_path: filePath,
        });
      }
      alert('Photos uploaded successfully!');
      setFiles([]);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!gallery) {
    return <div className={styles.loading}>Loading gallery...</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Upload Photos to "{gallery.name}"</h1>
      

      
      <form onSubmit={handleUpload} className={styles.form}>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className={styles.input}
        />
        <button
          type="submit"
          disabled={uploading || !files.length}
          className={styles.button}
        >
          {uploading ? 'Uploading...' : 'Upload Photos'}
        </button>
      </form>
      {files.length > 0 && (
        <div className={styles.preview}>
          <h3>Selected files:</h3>
          <ul>
            {files.map((file, idx) => (
              <li key={idx}>{file.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}