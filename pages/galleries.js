import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import styles from '../styles/Galleries.module.css';

export default function Galleries() {
  const [galleries, setGalleries] = useState([]);
  const [galleryThumbnails, setGalleryThumbnails] = useState({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchGalleries = async () => {
      const { data, error } = await supabase
        .from('galleries')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching galleries:', error);
        setGalleries([]);
      } else {
        setGalleries(data || []);
        // Fetch first photo for each gallery
        fetchFirstPhotos(data || []);
      }
      setLoading(false);
    };

    const fetchFirstPhotos = async (galleriesList) => {
      const thumbnails = {};
      
      for (const gallery of galleriesList) {
        // Get the first photo for this gallery
        const { data: photoData, error } = await supabase
          .from('photos')
          .select('storage_path, filename')
          .eq('gallery_id', gallery.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        
        if (error) {
          console.log(`No photos for gallery ${gallery.id}`);
          continue;
        }
        
        if (photoData && photoData.storage_path) {
          // Get the public URL for this photo
          const { data: publicUrlData } = supabase
            .storage
            .from('photos')
            .getPublicUrl(photoData.storage_path);
          
          if (publicUrlData && publicUrlData.publicUrl) {
            thumbnails[gallery.id] = publicUrlData.publicUrl;
          }
        }
      }
      
      setGalleryThumbnails(thumbnails);
    };

    fetchGalleries();

    // Realtime updates (optional)
    const subscription = supabase
      .channel('galleries-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'galleries' },
        () => fetchGalleries()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  if (loading) {
    return <div className={styles.loading}>Loading galleries...</div>;
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Tournament Photos | Ice Hockey Photo Gallery</title>
      </Head>

      <h1 className={styles.title}>
        <span role="img" aria-label="hockey stick" style={{ marginRight: 10 }}></span>
        GALLERIES
      </h1>

      {galleries.length === 0 ? (
        <p className={styles.noGalleries}>No galleries available.</p>
      ) : (
        <div className={styles.galleryGrid}>
          {galleries.map((gallery) => (
            <Link href={`/gallery/${gallery.id}`} key={gallery.id} className={styles.galleryCard}>
              <div>
                {galleryThumbnails[gallery.id] ? (
                  <img
                    src={galleryThumbnails[gallery.id]}
                    alt={`${gallery.name} thumbnail`}
                    className={styles.galleryThumbnail}
                  />
                ) : (
                  <div className={styles.galleryNoThumbnail}>📸</div>
                )}
                <h2 className={styles.galleryName}>
                  {gallery.name}
                </h2>
                <p className={styles.galleryDate}>
                  Created: {new Date(gallery.created_at).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}