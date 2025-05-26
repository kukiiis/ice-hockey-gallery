// lib/watermark.js
import { supabase } from './supabase';

export async function getWatermarkUrl() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'watermark_path')
      .single();
    
    if (error || !data?.value) return null;
    
    const { data: publicUrlData } = supabase
      .storage
      .from('watermarks')
      .getPublicUrl(data.value);
    
    return publicUrlData?.publicUrl || null;
  } catch (error) {
    console.error('Error fetching watermark:', error);
    return null;
  }
}