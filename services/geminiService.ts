import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { CreateFunction, EditFunction, ImageFile } from '../types';

if (!import.meta.env.VITE_GOOGLE_API_KEY) {
    throw new Error("VITE_GOOGLE_API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_API_KEY });

const applyPromptEnhancement = (prompt: string, func: CreateFunction): string => {
    switch (func) {
        case 'sticker':
            return `${prompt}, como um adesivo recortado, arte de adesivo, fundo branco, cores vibrantes`;
        case 'text':
            return `Logotipo vetorial minimalista de ${prompt}, linhas limpas, simples, profissional`;
        case 'comic':
            return `${prompt}, estilo de história em quadrinhos, contornos ousados, pontos de retícula, composição dinâmica`;
        case 'ultra':
            return `Resolução 4K, ultrarrealista, alta definição, detalhes nítidos, fotografia profissional de: ${prompt}`;
        case 'free':
        default:
            return prompt;
    }
};

export const generateImage = async (prompt: string, createFunction: CreateFunction, aspectRatio: string, isTransparent: boolean, outputMimeType: 'image/png' | 'image/jpeg' = 'image/png'): Promise<string> => {
    let enhancedPrompt = applyPromptEnhancement(prompt, createFunction);
    const finalMimeType = isTransparent ? 'image/png' : outputMimeType;
    
    if (isTransparent) {
        enhancedPrompt += ', fundo transparente, isolado em um fundo transparente, png';
    }
    
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: enhancedPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: finalMimeType,
          aspectRatio: aspectRatio,
        },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return `data:${finalMimeType};base64,${base64ImageBytes}`;
    }
    throw new Error("A geração de imagem falhou ou não retornou imagens.");
};

export const editImage = async (
    prompt: string,
    editFunction: EditFunction,
    images: ImageFile[],
    styleImage?: ImageFile,
    maskImage?: ImageFile
): Promise<string> => {
    
    let parts: any[] = [];
    let instruction = prompt;
    
    if (images.length === 0 && editFunction !== 'combine') {
        throw new Error("Uma imagem é necessária para esta função de edição.");
    }

    const baseImage = images[0];

    parts.push({
        inlineData: {
            data: baseImage.base64,
            mimeType: baseImage.mimeType,
        }
    });

    switch(editFunction) {
        case 'mockup':
            try {
                const { productName, backgroundStyle } = JSON.parse(prompt);
                const backgroundPrompts: { [key: string]: string } = {
                    'Transparente': 'com um fundo limpo e transparente, em formato png',
                    'Estúdio Fotográfico': 'em um ambiente de estúdio fotográfico profissional com iluminação suave e neutra',
                    'Ambiente de Escritório': 'sobre uma mesa ou superfície em um ambiente de escritório moderno e limpo',
                    'Ao Ar Livre': 'em um cenário externo natural e realista (como um parque, rua ou café)',
                };
                const backgroundInstruction = backgroundPrompts[backgroundStyle] || 'com um fundo neutro e sem distrações';
                instruction = `Crie um mockup fotorrealista de um(a) "${productName}" utilizando o design fornecido. Posicione o design de forma natural no produto, respeitando sua forma, textura, iluminação e perspectiva. A cena deve ser ${backgroundInstruction}. O resultado final deve ser apenas a imagem do mockup, sem textos ou elementos adicionais.`;
            } catch (e) {
                // Fallback for old simple prompt
                instruction = `Crie um mockup realista do produto com a imagem fornecida: ${prompt}`;
            }
            break;
        case 'variation':
            instruction = "Gere uma variação criativa e visualmente distinta desta imagem. Mantenha o tema principal e a composição geral, mas experimente com estilos, paletas de cores, texturas e fundos diferentes. O resultado deve ser uma nova interpretação artística da original.";
            break;
        case 'add-remove':
            if (maskImage) {
                parts.push({
                    inlineData: {
                        data: maskImage.base64,
                        mimeType: maskImage.mimeType,
                    }
                });
                instruction = `**INSTRUÇÃO CRÍTICA: EDIÇÃO COM MÁSCARA.** Você é um editor de fotos profissional. Você recebeu uma imagem e uma máscara preta e branca. Sua tarefa é realizar uma edição **exclusivamente dentro das áreas BRANCAS da máscara**. A solicitação do usuário é: "${prompt}". As áreas PRETAS da máscara **devem permanecer completamente intocadas e idênticas à imagem original.** Se não for possível realizar a edição solicitada, você **deve** responder com uma explicação em texto do motivo. Sua saída deve ser a imagem final editada ou uma explicação em texto.`;
            } else {
                instruction = `**INSTRUÇÃO CRÍTICA: APENAS EDITAR.** Você é um editor de fotos profissional. Sua tarefa é **modificar diretamente a imagem fornecida** com base na solicitação do usuário: "${prompt}". **NÃO crie uma nova imagem.** **NÃO substitua a imagem inteira.** Aplique as alterações solicitadas diretamente nos pixels da imagem original. O resultado **deve** ser a imagem original com as edições especificadas. Se não for possível realizar a edição solicitada, você **deve** responder com uma explicação em texto do motivo. Retorne apenas a imagem modificada ou a explicação em texto.`;
            }
            break;
        case 'retouch':
            instruction = `**INSTRUÇÃO CRÍTICA: APENAS RETOQUE.** Você é um retocador de fotos profissional. Sua tarefa é **editar e aprimorar diretamente a imagem fornecida.** Siga estas instruções precisamente: "${prompt}". **NÃO substitua o objeto, o fundo ou a composição geral, a menos que seja especificamente instruído.** Seu objetivo é melhorar a imagem existente, não criar uma nova. Se as instruções forem gerais (ex: "melhore isso"), realize retoques padrão como aprimoramento de cores, ajuste de brilho/contraste e aumento da nitidez. Se não for possível realizar o retoque solicitado, você **deve** responder com uma explicação em texto do motivo. Retorne apenas a imagem retocada ou a explicação em texto.`;
            break;
        case 'style':
            if (!styleImage) throw new Error("Uma imagem de referência de estilo é necessária para esta função.");
            parts.push({
                inlineData: {
                    data: styleImage.base64,
                    mimeType: styleImage.mimeType,
                }
            });
            instruction = `Aplique o estilo da segunda imagem à primeira. Instruções adicionais: ${prompt}. Retorne apenas a nova imagem composta.`;
            break;
        case 'compose':
            const image2_compose = images.length > 1 ? images[1] : undefined;
            if (!image2_compose) throw new Error("Duas imagens são necessárias para a função de composição.");
            parts.push({
                inlineData: {
                    data: image2_compose.base64,
                    mimeType: image2_compose.mimeType
                }
            });
            instruction = `Una, mescle ou componha estas duas imagens com base na seguinte instrução: ${prompt}. Retorne apenas a nova imagem composta.`;
            break;
        case 'combine':
             if (images.length < 2) throw new Error("Pelo menos duas imagens são necessárias para combinar.");
             // The first part (baseImage) is already added. Add the rest.
             for(let i = 1; i < images.length; i++) {
                parts.push({
                    inlineData: {
                        data: images[i].base64,
                        mimeType: images[i].mimeType,
                    }
                });
             }
            instruction = `**INSTRUÇÃO CRÍTICA: COMBINAR IMAGENS.** Você é um editor de fotos especialista. Você recebeu várias imagens. Sua tarefa é combiná-las em uma única imagem coesa com base na seguinte instrução: "${prompt}". A imagem final deve ser composta apenas por elementos das imagens fornecidas, a menos que as instruções indiquem o contrário. Se não for possível realizar a combinação conforme solicitado, responda com uma explicação em texto do motivo. Retorne apenas a imagem final combinada ou uma explicação em texto.`;
            break;
    }
    
    parts.push({ text: instruction });
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: parts },
      config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    let editedImage: string | null = null;
    let explanation: string | null = null;

    if (response.candidates && response.candidates.length > 0) {
        // The model can return both text and image. We prioritize the image.
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                editedImage = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
            } else if (part.text) {
                explanation = part.text;
            }
        }
    }

    if (editedImage) {
        return editedImage;
    }

    if (explanation) {
        throw new Error(`Resposta do Modelo: ${explanation}`);
    }

    throw new Error("A edição da imagem falhou. O modelo não retornou uma imagem ou uma explicação.");
};

export const upscaleImage = async (image: ImageFile): Promise<string> => {
    const prompt = "Aumente a escala desta imagem para 4x sua resolução original. Melhore os detalhes e a clareza, garantindo que o conteúdo e o estilo permaneçam idênticos ao original. Retorne apenas a imagem com a escala aumentada.";
    
    const parts = [
        {
            inlineData: {
                data: image.base64,
                mimeType: image.mimeType,
            }
        },
        { text: prompt }
    ];
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: parts },
      config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });
    
    let upscaledImage: string | null = null;
    let explanation: string | null = null;

    if (response.candidates && response.candidates.length > 0) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                upscaledImage = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
            } else if (part.text) {
                explanation = part.text;
            }
        }
    }

    if (upscaledImage) {
        return upscaledImage;
    }
    
    if (explanation) {
        throw new Error(`Resposta do Modelo: ${explanation}`);
    }

    throw new Error("O upscaling da imagem falhou. O modelo não retornou uma imagem ou uma explicação.");
};
