/**
 * AE Folder Organizer - Extension Constants
 * File extension arrays for category classification
 */

// ===== Video Extensions =====

export const VIDEO_EXTENSIONS = [
  "mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv", "flv", "mxf", "prores"
] as const;

// ===== Image Extensions =====

export const IMAGE_EXTENSIONS = [
  "jpg", "jpeg", "png", "psd", "tif", "tiff", "gif", "bmp", "ai", "eps", "svg"
] as const;

// ===== Sequence Extensions =====

// Common image formats that can be sequences
export const SEQUENCE_IMAGE_EXTENSIONS = [
  "png", "jpg", "jpeg", "tif", "tiff", "tga", "bmp", "gif"
] as const;

// CG/VFX sequence formats
export const SEQUENCE_CG_EXTENSIONS = [
  "exr", "dpx", "cin", "hdr"
] as const;

// All sequence-capable extensions
export const ALL_SEQUENCE_EXTENSIONS = [
  ...SEQUENCE_IMAGE_EXTENSIONS,
  ...SEQUENCE_CG_EXTENSIONS
] as const;

// ===== Audio Extensions =====

export const AUDIO_EXTENSIONS = [
  "mp3", "wav", "aac", "m4a", "aif", "aiff", "ogg", "flac"
] as const;

// ===== Extension Categories (for export/reference) =====

export const EXTENSION_CATEGORIES = {
  Video: VIDEO_EXTENSIONS,
  Images: IMAGE_EXTENSIONS,
  Sequences: SEQUENCE_CG_EXTENSIONS,
  Audio: AUDIO_EXTENSIONS,
} as const;

// ===== Type Exports =====

export type VideoExtension = typeof VIDEO_EXTENSIONS[number];
export type ImageExtension = typeof IMAGE_EXTENSIONS[number];
export type SequenceExtension = typeof ALL_SEQUENCE_EXTENSIONS[number];
export type AudioExtension = typeof AUDIO_EXTENSIONS[number];
