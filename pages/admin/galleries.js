import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import styles from '../../styles/AdminGalleries.module.css';

export default function AdminGalleries() {
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newGalleryName, setNewGalleryName] = useState('');
  const [creating, setCreating] = useState(false);
  const [user, setUser] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const router = useRouter();
  
  // Watermark states
  const [watermarkFile, setWatermarkFile] = useState(null);
  const [watermarkPreview, setWatermarkPreview] = useState('');
  const [watermarkLoading, setWatermarkLoading] = useState(false);

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
    fetchGalleries();
    fetchCurrentWatermark();
    };

    checkAdmin();
    
    // Set up realtime subscription
    const subscription = supabase
    .channel('galleries-changes')
    .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'galleries' },
    (payload) => {
    console.log('Gallery change detected:', payload);
    fetchGalleries();
    }
    )
    .subscribe();

    return () => {
    supabase.removeChannel(subscription);
    };
  }, [router]);

  const fetchGalleries = async () => {
    try {
    console.log('Fetching galleries...');
    const { data, error } = await supabase
    .from('galleries')
    .select('*')
    .order('created_at', { ascending: false });
    if (error) throw error;
    console.log('Galleries fetched:', data);
    setGalleries(data || []);
    } catch (error) {
    console.error('Error fetching galleries:', error);
    } finally {
    setLoading(false);
    }
  };

  // Fetch current watermark
  const fetchCurrentWatermark = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'watermark_path')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching watermark:', error);
        return;
      }
      
      if (data?.value) {
        const { data: publicUrlData } = supabase
          .storage
          .from('watermarks')
          .getPublicUrl(data.value);
        
        setWatermarkPreview(publicUrlData.publicUrl);
      }
    } catch (error) {
      console.error('Error fetching watermark:', error);
    }
  };

  const createGallery = async (e) => {
    e.preventDefault();
    if (!newGalleryName.trim()) return;
    setCreating(true);
    try {
    console.log('Creating gallery:', newGalleryName);
    const { data, error } = await supabase
    .from('galleries')
    .insert({
    name: newGalleryName.trim(),
    created_by: user.id
    })
    .select();
    if (error) throw error;
    
    console.log('Gallery created:', data);
    // Also update local state as a fallback
    setGalleries(prev => [data[0], ...prev]);
    setNewGalleryName('');
    } catch (error) {
    console.error('Error creating gallery:', error);
    alert('Failed to create gallery. Please try again.');
    } finally {
    setCreating(false);
    }
  };

  const handleUpload = (galleryId) => {
    router.push(`/admin/upload/${galleryId}`);
  };

  const handleView = (galleryId) => {
    router.push(`/gallery/${galleryId}`);
  };

  // --- Edit (Rename) ---
  const startEdit = (gallery) => {
    console.log('Starting edit for gallery:', gallery.id);
    setEditingId(gallery.id);
    setEditName(gallery.name);
  };

  const cancelEdit = () => {
    console.log('Canceling edit');
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (galleryId) => {
    if (!editName.trim()) return;
    try {
    console.log('Saving edit for gallery:', galleryId, 'New name:', editName);
    const { error } = await supabase
    .from('galleries')
    .update({ name: editName.trim() })
    .eq('id', galleryId);
    
    if (error) {
    console.error('Supabase error:', error);
    throw error;
    }
    
    console.log('Gallery renamed successfully');
    
    // Also update local state as a fallback
    setGalleries(galleries.map(g => 
    g.id === galleryId ? { ...g, name: editName.trim() } : g
    ));
    
    setEditingId(null);
    setEditName('');
    } catch (error) {
    console.error('Error renaming gallery:', error);
    alert('Failed to rename gallery: ' + error.message);
    }
  };

  // --- Delete ---
  const deleteGallery = async (galleryId) => {
    if (!window.confirm('Are you sure you want to delete this gallery? This will also delete all photos in this gallery.')) return;
    
    try {
    console.log('Deleting gallery:', galleryId);
    
    // Delete photos first
    const { error: photosError } = await supabase
    .from('photos')
    .delete()
    .eq('gallery_id', galleryId);
    
    if (photosError) {
    console.error('Error deleting photos:', photosError);
    // Continue anyway to try deleting the gallery
    }
    
    // Delete gallery
    const { error } = await supabase
    .from('galleries')
    .delete()
    .eq('id', galleryId);
    
    if (error) {
    console.error('Supabase error:', error);
    throw error;
    }
    
    console.log('Gallery deleted successfully');
    
    // Also update local state as a fallback
    setGalleries(galleries.filter(g => g.id !== galleryId));
    
    } catch (error) {
    console.error('Error deleting gallery:', error);
    alert('Failed to delete gallery: ' + error.message);
    }
  };

  // Watermark functions
  const handleWatermarkChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size should be less than 2MB');
      return;
    }
    
    setWatermarkFile(file);
    setWatermarkPreview(URL.createObjectURL(file));
  };
  
  const uploadWatermark = async () => {
    if (!watermarkFile) {
      alert('Please select a watermark image');
      return;
    }
    
    try {
      setWatermarkLoading(true);
      
      // Create settings table if it doesn't exist
      const { error: tableError } = await supabase.rpc('create_settings_if_not_exists');
      
      // Upload watermark to storage
      const fileName = `watermark_${Date.now()}.${watermarkFile.name.split('.').pop()}`;
      const { error: uploadError } = await supabase
        .storage
        .from('watermarks')
        .upload(fileName, watermarkFile, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // Save watermark path to settings
      const { error: settingsError } = await supabase
        .from('settings')
        .upsert({ 
          key: 'watermark_path', 
          value: fileName 
        });
      
      if (settingsError) throw settingsError;
      
      alert('Watermark uploaded successfully!');
      fetchCurrentWatermark();
    } catch (error) {
      console.error('Error uploading watermark:', error);
      alert('Error uploading watermark: ' + error.message);
    } finally {
      setWatermarkLoading(false);
    }
  };
  
  const removeWatermark = async () => {
    if (!confirm('Are you sure you want to remove the watermark?')) {
      return;
    }
    
    try {
      setWatermarkLoading(true);
      
      // Get current watermark path
      const { data, error: fetchError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'watermark_path')
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      if (data?.value) {
        // Delete from storage
        const { error: deleteError } = await supabase
          .storage
          .from('watermarks')
          .remove([data.value]);
        
        if (deleteError) throw deleteError;
      }
      
      // Remove from settings
      const { error: settingsError } = await supabase
        .from('settings')
        .delete()
        .eq('key', 'watermark_path');
      
      if (settingsError) throw settingsError;
      
      setWatermarkPreview('');
      setWatermarkFile(null);
      alert('Watermark removed successfully!');
    } catch (error) {
      console.error('Error removing watermark:', error);
      alert('Error removing watermark: ' + error.message);
    } finally {
      setWatermarkLoading(false);
    }
  };

  if (loading) {
    return (
    <div className={styles.loading}>Loading galleries...</div>
    );
  }

  return (
    <div className={styles.adminGalleriesContainer}>
    <Head>
    <title>Admin: Galleries | Ice Hockey Photo Gallery</title>
    </Head>

    <h1 className={styles.title}>Gallery Management</h1>

    {/* No back button needed on this page as it's the main admin page */}

    <div className={styles.createGallery}>
    <h2>Create New Gallery</h2>
    <form onSubmit={createGallery} className={styles.createForm}>
    <input
    type="text"
    placeholder="Gallery Name"
    value={newGalleryName}
    onChange={(e) => setNewGalleryName(e.target.value)}
    required
    className={styles.input}
    />
    <button
    type="submit"
    disabled={creating || !newGalleryName.trim()}
    className={styles.createButton}
    >
    {creating ? 'Creating...' : 'Create Gallery'}
    </button>
    </form>
    </div>

    {/* Watermark Section */}
    <div className={styles.createGallery}>
      <h2>Watermark Settings</h2>
      <div className={styles.watermarkSection}>
        {watermarkPreview && (
          <div className={styles.currentWatermark}>
            <h3>Current Watermark</h3>
            <img 
              src={watermarkPreview} 
              alt="Current watermark" 
              className={styles.watermarkPreview} 
            />
            <button
              onClick={removeWatermark}
              disabled={watermarkLoading}
              className={styles.deleteButton}
            >
              Remove Watermark
            </button>
          </div>
        )}
        
        <div className={styles.uploadWatermark}>
          <h3>{watermarkPreview ? 'Change Watermark' : 'Upload Watermark'}</h3>
          <p className={styles.watermarkTip}>For best results, use a PNG image with transparency</p>
          <input
            type="file"
            accept="image/*"
            onChange={handleWatermarkChange}
            className={styles.input}
          />
          {watermarkFile && (
            <button
              onClick={uploadWatermark}
              disabled={watermarkLoading}
              className={styles.createButton}
              style={{ marginTop: '10px' }}
            >
              {watermarkLoading ? 'Uploading...' : 'Upload Watermark'}
            </button>
          )}
        </div>
      </div>
    </div>

    <div className={styles.galleryList}>
    <h2>Existing Galleries</h2>
    {galleries.length === 0 ? (
    <p className={styles.noGalleries}>No galleries created yet.</p>
    ) : (
    <table className={styles.galleryTable}>
    <thead>
    <tr>
    <th>Name</th>
    <th>Created</th>
    <th>Actions</th>
    </tr>
    </thead>
    <tbody>
    {galleries.map((gallery) => (
    <tr key={gallery.id}>
    <td>
    {editingId === gallery.id ? (
    <input
    type="text"
    value={editName}
    onChange={e => setEditName(e.target.value)}
    className={styles.input}
    />
    ) : (
    gallery.name
    )}
    </td>
    <td>{new Date(gallery.created_at).toLocaleDateString()}</td>
    <td className={styles.actions}>
    {editingId === gallery.id ? (
    <>
    <button
    type="button"
    onClick={() => saveEdit(gallery.id)}
    className={styles.saveButton}
    >
    Save
    </button>
    <button
    type="button"
    onClick={cancelEdit}
    className={styles.cancelButton}
    >
    Cancel
    </button>
    </>
    ) : (
    <>
    <button
    type="button"
    onClick={() => handleUpload(gallery.id)}
    className={styles.uploadButton}
    >
    Upload Photos
    </button>
    <button
    type="button"
    onClick={() => handleView(gallery.id)}
    className={styles.viewButton}
    >
    View Gallery
    </button>
    <button
    type="button"
    onClick={() => startEdit(gallery)}
    className={styles.editButton}
    >
    Rename
    </button>
    <button
    type="button"
    onClick={() => deleteGallery(gallery.id)}
    className={styles.deleteButton}
    >
    Delete
    </button>
    </>
    )}
    </td>
    </tr>
    ))}
    </tbody>
    </table>
    )}
    </div>
    </div>
  );
}