import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-text-style/color';
import { FontSize } from '@tiptap/extension-text-style/font-size';
import { FontFamily } from '@tiptap/extension-text-style/font-family';
import { LineHeight } from '@tiptap/extension-text-style/line-height';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Mathematics } from '@tiptap/extension-mathematics';
import { Extension } from '@tiptap/core';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

const CodeBlockTabHandler = Extension.create({
  name: 'codeBlockTabHandler',
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive('codeBlock')) {
          return this.editor.commands.insertContent('  ');
        }
        return false;
      },
    };
  },
});

export function buildEditorExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false, // Replaced by CodeBlockLowlight
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    Subscript,
    Superscript,
    TextStyle,
    Color,
    FontSize,
    FontFamily,
    LineHeight,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    Image.configure({
      allowBase64: false,
      inline: false,
    }),
    Table.configure({
      resizable: true,
      lastColumnResizable: false,
    }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'plaintext',
    }),
    CodeBlockTabHandler,
    Mathematics.configure({
      katexOptions: {
        throwOnError: false,
      },
    }),
  ];
}
