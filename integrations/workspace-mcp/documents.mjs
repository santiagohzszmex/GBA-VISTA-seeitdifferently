import { fromMarkdown } from 'mdast-util-from-markdown';
import { documentMarkdown } from '../../src/workspace/documentModel.js';
function convert(node,marks=[]){const text=value=>({type:'text',text:value,...(marks.length?{marks}:{})});const children=(node.children||[]).flatMap(child=>convert(child,marks));
 switch(node.type){
 case 'text':return node.value?[text(node.value)]:[];
 case 'strong':return node.children.flatMap(child=>convert(child,[...marks,{type:'bold'}]));
 case 'emphasis':return node.children.flatMap(child=>convert(child,[...marks,{type:'italic'}]));
 case 'inlineCode':return [{type:'text',text:node.value,marks:[...marks,{type:'code'}]}];
 case 'link':if(!/^https?:\/\/[^\s<>]+$/.test(node.url))return children;return node.children.flatMap(child=>convert(child,[...marks,{type:'link',attrs:{href:node.url}}]));
 case 'heading':return [{type:'heading',attrs:{level:node.depth},content:children}];
 case 'paragraph':return [{type:'paragraph',content:children}];
 case 'list':return [{type:node.ordered?'orderedList':'bulletList',...(node.ordered?{attrs:{start:node.start||1}}:{}),content:children}];
 case 'listItem':return [{type:'listItem',content:children}];
 case 'blockquote':return [{type:'blockquote',content:children}];
 case 'code':return [{type:'codeBlock',content:node.value?[{type:'text',text:node.value}]:[]}];
 case 'break':return [{type:'hardBreak'}];
 case 'thematicBreak':return [{type:'horizontalRule'}];
 case 'image':return [{type:'text',text:`[Imagen: ${node.alt||node.url}]`}];
 case 'html':return [text(node.value)];
 default:return children;
 }}
export function document(source,markdown=false){if(Buffer.byteLength(source)>500000)throw Error('El texto supera 500 KB; divídelo en documentos.');const content=markdown?convert(fromMarkdown(source)):source.split(/\r?\n/).map(line=>({type:'paragraph',...(line?{content:[{type:'text',text:line}]}:{})}));const doc={type:'doc',attrs:{schemaVersion:2},content};if(Buffer.byteLength(JSON.stringify(doc))>1000000)throw Error('El documento convertido supera el límite del editor.');return doc;}
export const backup=documentMarkdown;
