"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { ensureHtmlDocument } from '@/lib/rich-text';
import { supabase } from '@/lib/supabase';

type RichTextEditorFieldProps = {
  label: string;
  value: string;
  onChange: (html: string) => void;
};

const lowlight = createLowlight(common);

const CODE_LANGUAGES = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'pseudocode', label: 'Pseudocode' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML/HTML' },
  { value: 'markdown', label: 'Markdown' },
];

export default function RichTextEditorField({
  label,
  value,
  onChange,
}: RichTextEditorFieldProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('plaintext');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const normalizedValue = useMemo(() => ensureHtmlDocument(value), [value]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Image,
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
      }),
    ],
    content: normalizedValue,
    editorProps: {
      attributes: {
        class: 'tiptap-editor min-h-[160px] p-4',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const editorHtml = editor.getHTML();
    if (editorHtml !== normalizedValue) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false });
    }
  }, [editor, normalizedValue]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    try {
      setIsUploading(true);
      
      // Attempt to delete existing if it's an overwrite, but typically these are novel file names
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('exam-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('exam-images').getPublicUrl(filePath);

      if (data?.publicUrl) {
        editor.chain().focus().setImage({ src: data.publicUrl, alt: file.name }).run();
      }
    } catch (err: any) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const insertImage = () => {
    fileInputRef.current?.click();
  };

  const applyCodeBlock = () => {
    if (!editor) {
      return;
    }

    const language = selectedLanguage === 'pseudocode' ? 'plaintext' : selectedLanguage;
    editor.chain().focus().setCodeBlock({ language }).run();
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>

      <div className="tiptap-shell border rounded-lg bg-white overflow-hidden">
        <div className="tiptap-toolbar border-b bg-gray-50 p-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`toolbar-btn ${editor?.isActive('bold') ? 'is-active' : ''}`}
          >
            Bold
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`toolbar-btn ${editor?.isActive('italic') ? 'is-active' : ''}`}
          >
            Italic
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`toolbar-btn ${editor?.isActive('bulletList') ? 'is-active' : ''}`}
          >
            Bullets
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={`toolbar-btn ${editor?.isActive('orderedList') ? 'is-active' : ''}`}
          >
            Numbered
          </button>
          <button
            type="button"
            onClick={insertImage}
            className="toolbar-btn"
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Insert Image'}
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />

          <div className="flex items-center gap-2">
            <select
              value={selectedLanguage}
              onChange={(event) => setSelectedLanguage(event.target.value)}
              className="text-sm border rounded px-2 py-1 bg-white"
            >
              {CODE_LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyCodeBlock}
              className={`toolbar-btn ${editor?.isActive('codeBlock') ? 'is-active' : ''}`}
            >
              Code Block
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
              className="toolbar-btn"
            >
              Clear
            </button>
          </div>
        </div>

        <EditorContent editor={editor} />
      </div>
    </div>
  );
}