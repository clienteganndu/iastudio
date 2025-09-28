import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Mode, CreateFunction, EditFunction, ImageFile } from '../types';
import FunctionCard from './FunctionCard';
import ImageUploadArea from './ImageUploadArea';
import MaskEditor from './MaskEditor';

// FIX: Added type definition for the Web Speech API's SpeechRecognition interface.
// This resolves the "Cannot find name 'SpeechRecognition'" TypeScript error.
interface SpeechRecognition {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((event: any) => void) | null;
    onresult: ((event: any) => void) | null;
    start: () => void;
    stop: () => void;
}

interface LeftPanelProps {
    onGenerate: (config: any) => void;
    isLoading: boolean;
    setInitialImage: (imageFile: ImageFile) => void;
}

const createFunctions: { id: CreateFunction; icon: string; name: string }[] = [
    { id: 'free', icon: '✨', name: 'Prompt' },
    { id: 'sticker', icon: '🏷️', name: 'Adesivos' },
    { id: 'text', icon: '📝', name: 'Logo' },
    { id: 'comic', icon: '💭', name: 'HQ' },
    { id: 'ultra', icon: '💎', name: '4K & Transparência' },
];

const editFunctions: { id: EditFunction; icon: string; name: string, requiresTwo?: boolean }[] = [
    { id: 'add-remove', icon: '➕', name: 'Adicionar' },
    { id: 'retouch', icon: '🎯', name: 'Retoque' },
    { id: 'style', icon: '🎨', name: 'Estilo' },
    { id: 'compose', icon: '🖼️', name: 'Unir', requiresTwo: true },
    { id: 'combine', icon: '✂️', name: 'Combinar' },
    { id: 'variation', icon: '🔄', name: 'Variações'},
];

const mockupProductData = {
    'Vestuário': ['Camiseta', 'Camisa polo', 'Moletom/Hoodie', 'Jaqueta', 'Boné/Chapéu', 'Shorts', 'Calça jeans', 'Saia', 'Vestido', 'Máscara facial'],
    'Acessórios': ['Caneca', 'Garrafa térmica', 'Bolsa/Mochila', 'Capinha de celular', 'Relógio', 'Pulseira/Colar', 'Óculos', 'Chaveiro'],
    'Embalagens': ['Caixa de presente', 'Sacola de compras', 'Caixa de pizza', 'Lata de refrigerante/cerveja', 'Garrafa de vidro', 'Cosméticos (creme, shampoo, perfume)'],
    'Tecnologia': ['Smartphone', 'Tablet', 'Notebook', 'Monitor de PC', 'Smartwatch', 'Fones de ouvido', 'Caixa de som'],
    'Impressos/Papelaria': ['Cartão de visita', 'Flyer/Panfleto', 'Pôster/Banner', 'Adesivo', 'Envelope', 'Revista/Livro aberto', 'Caderno/Planner'],
    'Decoração/Casa': ['Almofada', 'Quadro de parede', 'Tapete', 'Capa de cama', 'Cortina', 'Toalha'],
};

const backgroundOptions = [
    'Transparente', 'Estúdio Fotográfico', 'Ambiente de Escritório', 'Ao Ar Livre'
];

type MockupCategory = keyof typeof mockupProductData;

const fileToImageFile = (file: File): Promise<ImageFile> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result !== 'string') {
                return reject(new Error("Failed to read file as string"));
            }
            const base64 = reader.result.split(',')[1];
            resolve({ base64, mimeType: file.type });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const LeftPanel: React.FC<LeftPanelProps> = ({ onGenerate, isLoading, setInitialImage }) => {
    const [prompt, setPrompt] = useState('');
    const [mode, setMode] = useState<Mode>('create');
    const [activeCreateFunc, setActiveCreateFunc] = useState<CreateFunction>('free');
    const [activeEditFunc, setActiveEditFunc] = useState<EditFunction>('add-remove');
    
    // Edit mode images
    const [image1, setImage1] = useState<ImageFile | null>(null);
    const [image2, setImage2] = useState<ImageFile | null>(null);
    const [styleImage, setStyleImage] = useState<ImageFile | null>(null);
    const [maskImage, setMaskImage] = useState<ImageFile | null>(null);
    const [preview1, setPreview1] = useState<string | null>(null);
    const [preview2, setPreview2] = useState<string | null>(null);
    const [stylePreview, setStylePreview] = useState<string | null>(null);
    const [maskPreview, setMaskPreview] = useState<string | null>(null);
    const [combineImages, setCombineImages] = useState<(ImageFile | null)[]>([null, null, null]);
    const [combinePreviews, setCombinePreviews] = useState<(string | null)[]>([null, null, null]);
    const [isMaskEditorOpen, setIsMaskEditorOpen] = useState(false);
    
    // Create mode options
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [outputFormat, setOutputFormat] = useState<'image/png' | 'image/jpeg' | 'application/pdf'>('image/png');
    const [numVariations, setNumVariations] = useState(3);
    const [isTransparent, setIsTransparent] = useState(false);

    // Mockup mode state
    const [mockupDesign, setMockupDesign] = useState<ImageFile | null>(null);
    const [mockupPreview, setMockupPreview] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<MockupCategory>('Acessórios');
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [selectedBackground, setSelectedBackground] = useState<string>(backgroundOptions[1]);

    // Speech recognition state
    const [isListening, setIsListening] = useState(false);
    const [isSpeechSupported, setIsSpeechSupported] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const speechRecognitionRef = useRef<SpeechRecognition | null>(null);

    useEffect(() => {
        const loadVoices = () => {
          setVoices(window.speechSynthesis.getVoices());
        };
        if ('speechSynthesis' in window) {
          loadVoices();
          window.speechSynthesis.onvoiceschanged = loadVoices;
        }
        return () => {
          if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = null;
          }
        };
      }, []);

    const speakConfirmation = useCallback((text: string) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`Você pediu para criar: ${text}. Deseja continuar?`);
            utterance.lang = 'pt-BR';
            const ptVoice = voices.find(v => v.lang === 'pt-BR');
            if (ptVoice) {
                utterance.voice = ptVoice;
            }
            window.speechSynthesis.speak(utterance);
        }
    }, [voices]);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            setIsSpeechSupported(true);
            const recognition = new SpeechRecognition();
            recognition.lang = 'pt-BR';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (event) => {
                console.error("Erro no reconhecimento de fala:", event.error);
                setIsListening(false);
            };
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setPrompt(transcript);
                speakConfirmation(transcript);
            };
            speechRecognitionRef.current = recognition;
        } else {
            console.warn("Reconhecimento de fala não é suportado neste navegador.");
        }
    }, [speakConfirmation]);

    const handleMicClick = () => {
        const recognition = speechRecognitionRef.current;
        if (!recognition) return;
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    };

    const handleImageUpload = useCallback(async (file: File, imageSetter: (img: ImageFile | null) => void, previewSetter: (src: string | null) => void) => {
        if (file) {
            const dataUrl = URL.createObjectURL(file);
            previewSetter(dataUrl);
            const imageFile = await fileToImageFile(file);
            imageSetter(imageFile);
            if (mode === 'edit' && imageSetter === setImage1 && !image1) {
                setInitialImage(imageFile);
            }
        }
    }, [mode, image1, setInitialImage]);
    
    const handleCombineImageUpload = useCallback(async (file: File, index: number) => {
        if (file) {
            const dataUrl = URL.createObjectURL(file);
            const imageFile = await fileToImageFile(file);

            setCombinePreviews(prev => {
                const newPreviews = [...prev];
                newPreviews[index] = dataUrl;
                return newPreviews;
            });
            setCombineImages(prev => {
                const newImages = [...prev];
                newImages[index] = imageFile;
                return newImages;
            });
        }
    }, []);

    const addCombineImageSlot = () => {
        setCombineImages(prev => [...prev, null]);
        setCombinePreviews(prev => [...prev, null]);
    };
    
    const handleProductSelect = (product: string) => {
        if (isBatchMode) {
            setSelectedProducts(prev => 
                prev.includes(product) ? prev.filter(p => p !== product) : [...prev, product]
            );
        } else {
            setSelectedProducts([product]);
        }
    };

    const handleGenerateClick = () => {
        if (mode === 'mockup') {
            const config = {
                mode: 'mockup',
                design: mockupDesign,
                requests: selectedProducts.map(product => ({
                    productName: product,
                    backgroundStyle: selectedBackground,
                })),
            };
            onGenerate(config);
            return;
        }

        let images: (ImageFile | null)[] = [];
        if (mode === 'edit') {
            switch (activeEditFunc) {
                case 'compose':
                    images = [image1, image2];
                    break;
                case 'combine':
                    images = combineImages.filter(Boolean);
                    break;
                default:
                    images = [image1];
                    break;
            }
        }

        const config = {
            prompt,
            mode,
            createFunction: activeCreateFunc,
            editFunction: activeEditFunc,
            images: images.filter(Boolean) as ImageFile[],
            styleImage,
            maskImage,
            aspectRatio,
            outputFormat,
            numVariations,
            isTransparent: activeCreateFunc === 'ultra' ? isTransparent : false,
        };
        onGenerate(config);
    };
    
    const handleEditFunctionClick = (func: EditFunction) => {
        setActiveEditFunc(func);
        setStyleImage(null);
        setStylePreview(null);
        setMaskImage(null);
        setMaskPreview(null);
        if (func !== 'combine') {
            setCombineImages([null, null, null]);
            setCombinePreviews([null, null, null]);
        }
    };
    
    const handleModeChange = (newMode: Mode) => {
        setMode(newMode);
        // Reset results or specific states when changing mode
    };

    const handleSaveMask = (maskFile: ImageFile) => {
        setMaskImage(maskFile);
        setMaskPreview(`data:image/png;base64,${maskFile.base64}`);
        setIsMaskEditorOpen(false);
    };

    const isGenerateDisabled = isLoading || (
        (mode === 'create' && !prompt) ||
        (mode === 'edit' && (
            (!prompt && !['retouch', 'variation'].includes(activeEditFunc)) ||
            (['add-remove', 'retouch', 'style', 'variation'].includes(activeEditFunc) && !image1) ||
            (activeEditFunc === 'compose' && (!image1 || !image2)) ||
            (activeEditFunc === 'style' && !styleImage) ||
            (activeEditFunc === 'combine' && combineImages.filter(Boolean).length < 2)
        )) ||
        (mode === 'mockup' && (!mockupDesign || selectedProducts.length === 0))
    );

    const generateButtonText = () => {
        if (isLoading) return 'Gerando...';
        if (mode === 'mockup') return 'Gerar Mockups ✨';
        if (mode === 'edit' && activeEditFunc === 'variation') return 'Gerar Variações 🔄';
        if (mode === 'create' && activeCreateFunc === 'ultra') return 'Gerar 4K ✨';
        return 'Gerar Imagem ✨';
    }

    return (
        <>
            <div className="left-panel bg-gray-800 p-6 rounded-l-2xl flex flex-col space-y-6 overflow-y-auto h-full">
                <header>
                    <h1 className="panel-title text-3xl font-bold text-purple-400">🎨 AI Ganndu Studio</h1>
                    <p className="panel-subtitle text-gray-400">Gerador profissional de imagens</p>
                </header>
                
                <div className={`prompt-section relative ${
                    (mode === 'edit' && ['variation'].includes(activeEditFunc)) || mode === 'mockup' ? 'hidden' : ''
                }`}>
                    <label htmlFor="prompt" className="section-title text-lg font-semibold mb-2 block">💭 Descreva sua ideia</label>
                    <textarea
                        id="prompt"
                        className="prompt-input w-full bg-gray-700 border border-gray-600 rounded-md p-3 pr-12 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
                        placeholder={activeEditFunc === 'combine' ? "Escreva como deseja combinar essas imagens..." : "Descreva a imagem que você deseja criar ou editar..."}
                        rows={4}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={isLoading}
                        aria-label="Prompt de imagem"
                    ></textarea>
                    {isSpeechSupported && (
                        <button
                            onClick={handleMicClick}
                            disabled={isLoading}
                            className={`absolute right-3 bottom-3 h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-purple-500 active:scale-95 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-purple-600 hover:bg-purple-700'}`}
                            aria-label={isListening ? 'Parar gravação' : 'Gravar prompt por voz'}
                            title={isListening ? 'Parar gravação' : 'Gravar prompt por voz'}
                        >
                            <span role="img" aria-label="microphone" className="text-xl">🎤</span>
                        </button>
                    )}
                </div>
                
                <div className="mode-toggle grid grid-cols-3 gap-2 bg-gray-700 p-1 rounded-md">
                    <button className={`mode-btn p-2 rounded transition active:scale-95 ${mode === 'create' ? 'bg-purple-600' : ''}`} onClick={() => handleModeChange('create')} disabled={isLoading} aria-pressed={mode === 'create'}>Criar</button>
                    <button className={`mode-btn p-2 rounded transition active:scale-95 ${mode === 'edit' ? 'bg-purple-600' : ''}`} onClick={() => handleModeChange('edit')} disabled={isLoading} aria-pressed={mode === 'edit'}>Editar</button>
                    <button className={`mode-btn p-2 rounded transition active:scale-95 ${mode === 'mockup' ? 'bg-purple-600' : ''}`} onClick={() => handleModeChange('mockup')} disabled={isLoading} aria-pressed={mode === 'mockup'}>Mockups</button>
                </div>

                {mode === 'create' && (
                    <div key="create" id="createFunctions" className="functions-section animate-fadeIn">
                        <div className="functions-grid grid grid-cols-2 md:grid-cols-4 lg:grid-cols-3 gap-4">
                            {createFunctions.map(fn => (
                                <FunctionCard key={fn.id} {...fn} isActive={activeCreateFunc === fn.id} onClick={() => setActiveCreateFunc(fn.id)} />
                            ))}
                        </div>
                        {activeCreateFunc === 'ultra' && (
                           <div className="transparency-section mt-6 p-4 bg-gray-700 rounded-lg">
                                <label htmlFor="transparent-toggle" className="flex items-center justify-between cursor-pointer">
                                    <span className="section-title text-lg font-semibold">Fundo Transparente</span>
                                    <div className="relative">
                                        <input type="checkbox" id="transparent-toggle" className="sr-only" checked={isTransparent} onChange={(e) => setIsTransparent(e.target.checked)} disabled={isLoading}/>
                                        <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isTransparent ? 'transform translate-x-6 bg-purple-400' : ''}`}></div>
                                    </div>
                                </label>
                            </div>
                        )}
                        <div className="aspect-ratio-section mt-6">
                            <label className="section-title text-lg font-semibold mb-2 block">📐 Proporção</label>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {(['9:16', '3:4', '1:1', '4:3', '16:9'] as const).map(ratio => (
                                    <button key={ratio} className={`p-2 rounded transition text-sm active:scale-95 ${aspectRatio === ratio ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`} onClick={() => setAspectRatio(ratio)} disabled={isLoading}>{ratio}</button>
                                ))}
                            </div>
                        </div>
                        <div className="output-format-section mt-6">
                            <label className="section-title text-lg font-semibold mb-2 block">🖼️ Formato de Saída</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button key="png" className={`p-2 rounded transition text-sm active:scale-95 ${outputFormat === 'image/png' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`} onClick={() => setOutputFormat('image/png')} disabled={isLoading || isTransparent}>PNG (Qualidade)</button>
                                <button key="jpeg" className={`p-2 rounded transition text-sm active:scale-95 ${outputFormat === 'image/jpeg' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`} onClick={() => setOutputFormat('image/jpeg')} disabled={isLoading || isTransparent}>JPEG (Leve)</button>
                                <button key="pdf" className={`p-2 rounded transition text-sm active:scale-95 ${outputFormat === 'application/pdf' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`} onClick={() => setOutputFormat('application/pdf')} disabled={isLoading}>PDF (Documento)</button>
                            </div>
                        </div>
                    </div>
                )}
                
                {mode === 'edit' && (
                    <div key="edit" id="editFunctions" className="functions-section animate-fadeIn">
                        <div className="functions-grid grid grid-cols-2 md:grid-cols-4 gap-4">
                            {editFunctions.map(fn => (
                                <FunctionCard key={fn.id} {...fn} isActive={activeEditFunc === fn.id} onClick={() => handleEditFunctionClick(fn.id)} />
                            ))}
                        </div>
                        <div className="image-upload-section mt-6 space-y-4">
                             {activeEditFunc === 'combine' ? (
                                <>
                                    {combinePreviews.map((preview, index) => (
                                        <ImageUploadArea key={index} id={`combine-image-upload-${index}`} title={`Carregar Imagem ${index + 1}`} subtitle="Clique ou arraste uma imagem" previewSrc={preview} onImageUpload={(file) => handleCombineImageUpload(file, index)}/>
                                    ))}
                                    <button onClick={addCombineImageSlot} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 active:scale-95">+ Adicionar mais imagens</button>
                                </>
                             ) : activeEditFunc === 'variation' ? (
                                <>
                                    <ImageUploadArea id="image1-upload" title="Carregar Imagem Original" subtitle="Clique ou arraste uma imagem" previewSrc={preview1} onImageUpload={(file) => handleImageUpload(file, setImage1, setPreview1)}/>
                                    <div className="num-variations-section">
                                        <label className="section-title text-lg font-semibold mb-2 block">🔢 Número de Variações</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[3, 4, 5].map(num => (
                                                <button key={num} className={`p-2 rounded transition text-sm active:scale-95 ${numVariations === num ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`} onClick={() => setNumVariations(num)} disabled={isLoading}>{num} Variações</button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <ImageUploadArea id="image1-upload" title={activeEditFunc === 'compose' ? "Imagem Base" : "Carregar Imagem"} subtitle="Clique ou arraste uma imagem" previewSrc={preview1} onImageUpload={(file) => handleImageUpload(file, setImage1, setPreview1)}/>
                                    {activeEditFunc === 'compose' && ( <ImageUploadArea id="image2-upload" title="Imagem para Unir" subtitle="Clique ou arraste a segunda imagem" previewSrc={preview2} onImageUpload={(file) => handleImageUpload(file, setImage2, setPreview2)}/> )}
                                    {activeEditFunc === 'style' && ( <ImageUploadArea id="style-image-upload" title="Imagem de Estilo" subtitle="Envie uma imagem para copiar o estilo" previewSrc={stylePreview} onImageUpload={(file) => handleImageUpload(file, setStyleImage, setStylePreview)}/> )}
                                    {activeEditFunc === 'add-remove' && image1 && (
                                        <div className="mask-section text-center">
                                            <button onClick={() => setIsMaskEditorOpen(true)} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 active:scale-95">{maskImage ? '✏️ Editar Máscara' : '🖌️ Criar Máscara'}</button>
                                            {maskPreview && ( <div className="mt-2"><p className="text-xs text-gray-400 mb-1">Prévia da Máscara:</p><img src={maskPreview} alt="Mask Preview" className="w-24 h-24 object-cover rounded-md mx-auto border border-gray-600" /></div> )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {mode === 'mockup' && (
                    <div key="mockup" id="mockupFunctions" className="functions-section animate-fadeIn space-y-6">
                        <ImageUploadArea id="mockup-design-upload" title="Carregar Logo ou Design" subtitle="Clique ou arraste uma imagem (PNG, JPG)" previewSrc={mockupPreview} onImageUpload={(file) => handleImageUpload(file, setMockupDesign, setMockupPreview)}/>
                        
                        <div>
                            <label htmlFor="category-select" className="section-title text-lg font-semibold mb-2 block">📦 Escolha um Produto para Mockup</label>
                            <select id="category-select" value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value as MockupCategory); setSelectedProducts([]); }} className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-purple-500 transition">
                                {Object.keys(mockupProductData).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>

                        <div className="product-selection">
                            <label className="flex items-center justify-between cursor-pointer mb-4">
                                <span className="section-title text-lg font-semibold">Gerar Mockups em Lote</span>
                                <div className="relative">
                                    <input type="checkbox" id="batch-toggle" className="sr-only" checked={isBatchMode} onChange={(e) => { setIsBatchMode(e.target.checked); setSelectedProducts([]); }}/>
                                    <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isBatchMode ? 'transform translate-x-6 bg-purple-400' : ''}`}></div>
                                </div>
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {mockupProductData[selectedCategory].map(product => (
                                    <button key={product} onClick={() => handleProductSelect(product)} className={`p-3 rounded-lg text-sm font-medium transition active:scale-95 text-center ${selectedProducts.includes(product) ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{product}</button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="section-title text-lg font-semibold mb-2 block">🖼️ Customização de Fundo</label>
                            <div className="grid grid-cols-2 gap-2">
                                {backgroundOptions.map(bg => (
                                    <button key={bg} onClick={() => setSelectedBackground(bg)} className={`p-2 rounded transition text-sm active:scale-95 ${selectedBackground === bg ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}>{bg}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                
                <button className="generate-btn w-full mt-auto bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed active:scale-95" onClick={handleGenerateClick} disabled={isGenerateDisabled}>
                    {generateButtonText()}
                </button>
            </div>
            {isMaskEditorOpen && preview1 && (
                <MaskEditor baseImageSrc={preview1} onSave={handleSaveMask} onClose={() => setIsMaskEditorOpen(false)}/>
            )}
        </>
    );
};

export default LeftPanel;
