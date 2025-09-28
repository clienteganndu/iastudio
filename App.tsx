import React, { useState, useCallback } from 'react';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import ImagePreviewModal from './components/ImagePreviewModal';
import { generateImage, editImage, upscaleImage } from './services/geminiService';
import { ImageFile } from './types';

function App() {
    const [isLoading, setIsLoading] = useState(false);
    const [isUpscaling, setIsUpscaling] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [generatedVariations, setGeneratedVariations] = useState<(string | null | 'error')[]>([]);
    const [generatedMockups, setGeneratedMockups] = useState<(string | null | 'error')[]>([]);
    const [variationBaseImage, setVariationBaseImage] = useState<ImageFile | null>(null);
    const [modalImage, setModalImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [initialImageForEdit, setInitialImageForEdit] = useState<ImageFile | null>(null);
    const [downloadFormat, setDownloadFormat] = useState<'image/png' | 'image/jpeg' | 'application/pdf'>('image/png');

    const handleGenerate = useCallback(async (config: any) => {
        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);
        setGeneratedVariations([]);
        setVariationBaseImage(null);
        setGeneratedMockups([]);

        try {
            if (config.mode === 'mockup') {
                if (!config.design || config.requests.length === 0) {
                    throw new Error("Um design e pelo menos um produto são necessários para gerar mockups.");
                }
                
                setGeneratedMockups(Array(config.requests.length).fill(null));

                const promises = config.requests.map((request: any, index: number) => 
                    editImage(
                        JSON.stringify({
                            productName: request.productName,
                            backgroundStyle: request.backgroundStyle
                        }),
                        'mockup',
                        [config.design]
                    ).then(result => {
                         setGeneratedMockups(prev => {
                            const newMockups = [...prev];
                            newMockups[index] = result;
                            return newMockups;
                        });
                    }).catch(e => {
                        console.error(`Falha ao gerar mockup para ${request.productName}:`, e);
                        setGeneratedMockups(prev => {
                            const newMockups = [...prev];
                            newMockups[index] = 'error';
                            return newMockups;
                        });
                    })
                );
                await Promise.allSettled(promises);

            } else if (config.createFunction === 'ultra' && config.mode === 'create') {
                // Step 1: Generate the initial high-quality image
                const initialImage = await generateImage(
                    config.prompt,
                    config.createFunction,
                    config.aspectRatio,
                    config.isTransparent,
                    'image/png' // Force PNG for transparency and quality
                );
                setGeneratedImage(initialImage);

                // Step 2: Automatically upscale the generated image to 4K
                setIsLoading(false);
                setIsUpscaling(true);

                const match = initialImage.match(/^data:(image\/(?:png|jpeg|webp));base64,(.*)$/);
                if (!match) {
                    throw new Error("Formato de imagem inválido para upscaling.");
                }
                const imageFile: ImageFile = { mimeType: match[1], base64: match[2] };
                
                const upscaledImageResult = await upscaleImage(imageFile);
                setGeneratedImage(upscaledImageResult);
                
                setDownloadFormat('image/png');

            } else if (config.editFunction === 'variation' && config.mode === 'edit') {
                if (!config.images || config.images.length === 0) {
                    throw new Error("Uma imagem é necessária para gerar variações.");
                }
                const baseImage = config.images[0];
                setVariationBaseImage(baseImage);

                const numVariations = config.numVariations || 3;
                setGeneratedVariations(Array(numVariations).fill(null));

                const promises = Array.from({ length: numVariations }, (_, i) => 
                    editImage(
                        "generate variation",
                        'variation',
                        [baseImage]
                    ).then(result => {
                         setGeneratedVariations(prev => {
                            const newVariations = [...prev];
                            newVariations[i] = result;
                            return newVariations;
                        });
                    }).catch(e => {
                        console.error(`Falha ao gerar variação ${i+1}:`, e);
                        // Update state to show an error for this specific item
                        setGeneratedVariations(prev => {
                            const newVariations = [...prev];
                            newVariations[i] = 'error';
                            return newVariations;
                        });
                    })
                );
                
                await Promise.allSettled(promises);

            } else {
                let resultImage: string;
                if (config.mode === 'create') {
                    const apiFormat = config.outputFormat === 'image/jpeg' ? 'image/jpeg' : 'image/png';
                    resultImage = await generateImage(config.prompt, config.createFunction, config.aspectRatio, false, apiFormat);
                    setDownloadFormat(config.outputFormat);
                } else {
                    if (!config.images || config.images.length === 0) {
                        throw new Error("An image is required for editing.");
                    }
                    resultImage = await editImage(
                        config.prompt, 
                        config.editFunction, 
                        config.images,
                        config.styleImage,
                        config.maskImage
                    );
                    const mimeType = resultImage.match(/data:(.*?);/)?.[1] as 'image/png' | 'image/jpeg' || 'image/png';
                    setDownloadFormat(mimeType);
                }
                setGeneratedImage(resultImage);
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
            setIsUpscaling(false);
        }
    }, []);

    const handleUpscale = useCallback(async () => {
        if (!generatedImage) return;

        setIsUpscaling(true);
        setError(null);
        try {
            const match = generatedImage.match(/^data:(image\/(?:png|jpeg|webp));base64,(.*)$/);
            if (!match) {
                throw new Error("Formato de imagem inválido para upscaling.");
            }
            const mimeType = match[1];
            const base64 = match[2];

            const imageFile: ImageFile = { base64, mimeType };

            const upscaledImageResult = await upscaleImage(imageFile);
            setGeneratedImage(upscaledImageResult);
            
            const newMimeType = upscaledImageResult.match(/data:(.*?);/)?.[1] as 'image/png' | 'image/jpeg' || 'image/png';
            setDownloadFormat(newMimeType);

        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Ocorreu um erro desconhecido durante o upscaling.');
        } finally {
            setIsUpscaling(false);
        }
    }, [generatedImage]);

    const handleEditCurrentImage = useCallback(() => {
      // This function would ideally set the app to 'edit' mode and pass the generated image to the LeftPanel.
      // For this implementation, we will log a message as direct state manipulation of a child is complex.
      // A more robust solution would involve a global state manager (like Context or Redux).
      alert("Para editar, vá para o modo 'Editar' e envie esta imagem salva.");
    }, []);
    
    const handleGenerateMockupVariations = useCallback((imageUrl: string) => {
        alert("Funcionalidade 'Gerar Variações' para mockups será implementada em breve!");
        // Future implementation:
        // Convert imageUrl to ImageFile
        // Call handleGenerate with variation config
    }, []);

    const handleSaveToFavorites = useCallback((imageUrl: string) => {
        alert("Funcionalidade 'Salvar nos Favoritos' será implementada em breve!");
    }, []);

    return (
        <div className="container mx-auto h-screen max-h-screen flex flex-col md:flex-row font-sans overflow-hidden">
            <main className="flex flex-1 overflow-hidden">
                <div className="w-full md:w-1/3 lg:w-1/4 max-h-screen">
                    <LeftPanel 
                      onGenerate={handleGenerate} 
                      isLoading={isLoading || isUpscaling} 
                      setInitialImage={setInitialImageForEdit}
                    />
                </div>
                <div className="w-full md:w-2/3 lg:w-3/ay-4 max-h-screen">
                    <RightPanel 
                        isLoading={isLoading} 
                        isUpscaling={isUpscaling}
                        generatedImage={generatedImage}
                        variationBaseImage={variationBaseImage}
                        generatedVariations={generatedVariations}
                        generatedMockups={generatedMockups}
                        onEdit={handleEditCurrentImage}
                        onUpscale={handleUpscale}
                        onVariationClick={setModalImage}
                        onGenerateMockupVariations={handleGenerateMockupVariations}
                        onSaveToFavorites={handleSaveToFavorites}
                        downloadFormat={downloadFormat}
                    />
                </div>
            </main>
            {modalImage && (
                <ImagePreviewModal
                    imageUrl={modalImage}
                    onClose={() => setModalImage(null)}
                />
            )}
            {error && (
                <div className="absolute bottom-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-lg">
                    <p><strong>Error:</strong> {error}</p>
                </div>
            )}
        </div>
    );
}

export default App;
