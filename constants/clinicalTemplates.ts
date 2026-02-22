
import { ClinicalTemplate } from "../types";

const generateId = (): string => Math.random().toString(36).substring(2, 9);

export const DEFAULT_CLINICAL_TEMPLATES: ClinicalTemplate[] = [
   // =========================================================================
   // RESPIRATORIO
   // =========================================================================
   {
      id: "tpl_resp_01",
      title: "Virosis Respiratoria (Adulto)",
      category: "indication",
      roles: ["MEDICO", "ENFERMERA"],
      content: `INDICACIONES - CUADRO RESPIRATORIO VIRAL
1. Reposo relativo en casa por 3 días.
2. Aislamiento dentro del hogar:
   - Ventilar la habitación frecuentemente.
   - Usar mascarilla si hay contacto con otras personas.
   - No compartir cubiertos, vasos ni toallas.
   - Lavado frecuente de manos.
3. Hidratación abundante (mínimo 2 litros de agua al día).
4. Evitar cambios bruscos de temperatura y exposición al frío o contaminantes (humo de tabaco).
5. Alimentación liviana fraccionada.
6. Control de temperatura cada 8 horas.
7. Consultar en URGENCIAS si presenta:
   - Dificultad para respirar (sensación de falta de aire).
   - "Pitos" o silbidos al pecho.
   - Fiebre sobre 38.5°C que no baja con medicamentos tras 48 horas.
   - Compromiso del estado general.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_resp_02",
      title: "Virosis Respiratoria (Niño)",
      category: "indication",
      content: `INDICACIONES - CUADRO RESPIRATORIO VIRAL (PEDIÁTRICO)
1. Reposo en casa mientras dure la fiebre y el malestar.
2. Aseo nasal frecuente con suero fisiológico antes de comer y dormir.
3. Ofrecer líquidos fraccionados frecuentemente.
4. Mantener lactancia materna a libre demanda (si corresponde).
5. Control de temperatura y manejo de fiebre según indicación de medicamentos.
6. SIGNOS DE ALARMA (Acudir a Urgencia):
   - Respiración rápida o con dificultad (se le hunden las costillas).
   - Aleteo nasal (se le abren los orificios de la nariz al respirar).
   - Coloración azulada o pálida alrededor de la boca.
   - Rechazo alimentario o del pecho.
   - Fiebre persistente o dificultad para despertar.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_resp_03",
      title: "Bronquitis Aguda",
      category: "indication",
      content: `INDICACIONES - BRONQUITIS AGUDA
1. Reposo relativo, evitar esfuerzos físicos.
2. Abundante hidratación para fluidificar secreciones.
3. Evitar tabaco y contaminantes ambientales.
4. Dormir semisentado si hay mucha tos nocturna.
5. Medicamentos:
   - Broncodilatadores (Inhalador): 2 puff cada 4-6 horas con aerocámara.
   - Analgésicos/Antipiréticos según necesidad.
6. Kinesioterapia respiratoria si se indicó.
7. Consultar si: Fiebre > 38.5°C por más de 3 días, desgarro con sangre o ahogo.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_resp_04",
      title: "Rinosinusitis Aguda",
      category: "indication",
      content: `INDICACIONES - SINUSITIS AGUDA
1. Lavados nasales con suero fisiológico abundante 3-4 veces al día.
2. Calor local en zona facial (frente y pómulos) para aliviar dolor.
3. Analgésicos y corticoides nasales según receta.
4. Antibióticos: SOLO si fueron indicados por el médico, completar tratamiento por los días señalados.
5. Evitar cambios bruscos de temperatura.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_resp_05",
      title: "Faringoamigdalitis",
      category: "indication",
      content: `INDICACIONES - AMIGDALITIS/FARINGITIS
1. Régimen blando y papillas a temperatura ambiente o frías (evitar cosas calientes, cítricos y picantes).
2. Hidratación abundante.
3. Gargarismos con agua tibia y sal o colutorios antisépticos (si tolera).
4. Antibióticos: Completar estrictamente los días indicados aunque se sienta mejor (si es bacteriana).
5. Cambio de cepillo de dientes al completar tratamiento.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_resp_06",
      title: "Neumonía (Manejo Ambulatorio)",
      category: "indication",
      content: `INDICACIONES - NEUMONÍA
1. Reposo absoluto en cama por 3-5 días.
2. Hidratación abundante (2.5 - 3 litros diarios).
3. Antibióticos son VITALES: Respetar horario estricto.
4. Kinesiología respiratoria (según indicación).
5. Consultar Urgencia si: Labios morados, fiebre persistente > 3 días, confusión o desorientación.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_resp_07",
      title: "Influenza / Gripe",
      category: "indication",
      content: `INDICACIONES - INFLUENZA
1. Aislamiento respiratorio (mascarilla).
2. Control de la fiebre con paracetamol/dipirona (horario).
3. Reposo relativo por 5 días.
4. Signos de alarma: Dificultad respiratoria progresiva.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_resp_08",
      title: "Rinitis Alérgica",
      category: "indication",
      content: `INDICACIONES - RINITIS ALÉRGICA
1. Evitar alérgenos conocidos (polvo, polen, pelos de mascota).
2. Aseo nasal diario.
3. Ventilar habitación en la mañana. No tener alfombras ni peluches en dormitorio.
4. Uso de antihistamínicos en la noche si hay síntomas.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_resp_09",
      title: "Laringitis Aguda (Disfonía)",
      category: "indication",
      content: `INDICACIONES - LARINGITIS
1. Reposo de la voz (hablar lo mínimo posible, no susurrar ya que fuerza más).
2. Hidratación abundante.
3. Evitar irritantes (humo, frío, alcohol).
4. Vaporización en el baño (ducha caliente) para humectar vía aérea.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_resp_10",
      title: "COVID-19 (Leve)",
      category: "indication",
      content: `INDICACIONES - COVID-19 (LEVE)
1. Aislamiento por 5 días (o según normativa vigente).
2. Uso de mascarilla al estar con otros.
3. Paracetamol 1g cada 8 horas si hay fiebre o dolor.
4. Consultar Urgencia: Dificultad respiratoria.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // TRAUMATOLOGÍA
   // =========================================================================
   {
      id: "lumbago-agudo",
      title: "Lumbago Agudo",
      content: `INDICACIONES - LUMBAGO AGUDO
1. Reposo relativo por 2-3 días. Evitar levantar objetos pesados.
2. Calor local en zona lumbar por 20 minutos, 3 veces al día.
3. Postura: Dormir de lado con almohada entre las rodillas.
4. Medicamentos según receta médica.
5. Kinesiología motora de columna lumbar (si se indicó).`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "esguince-tobillo",
      title: "Esguince de Tobillo",
      content: `INDICACIONES - ESGUINCE DE TOBILLO
1. RICE: Reposo, Hielo, Compresión, Elevación.
   - Hielo: 15 min cada 4 horas (primeras 48 hrs).
   - Pie en alto.
2. Uso de tobillera o inmovilizador según indicación.
3. Carga progresiva según tolere el dolor (usar muletas si es necesario).
4. Analgesia según receta.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_trauma_03",
      title: "Tendinitis Manguito Rotador",
      content: `INDICACIONES - HOMBRO DOLOROSO / TENDINITIS
1. Evitar movimientos del brazo por sobre la altura del hombro.
2. No dormir sobre el hombro afectado.
3. Hielo local por 15 minutos, 3 veces al día si hay dolor agudo.
4. Ejercicios pendulares suaves si no hay dolor.
5. Kinesiología según orden médica.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_trauma_04",
      title: "Fascitis Plantar",
      content: `INDICACIONES - FASCITIS PLANTAR (DOLOR TALÓN)
1. Estiramientos de pantorrilla y planta del pie (mañana y noche).
2. Masaje en planta del pie con botella de agua congelada (rodar la botella) por 10 min.
3. Uso de calzado con buen soporte (evitar zapatillas planas o chalas).
4. Plantillas ortopédicas si se indicaron.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_trauma_05",
      title: "Contusión Costal",
      content: `INDICACIONES - GOLPE EN COSTILLAS
1. Reposo relativo, evitar cargar peso o deportes.
2. Hielo local en zona de dolor por 15 min, 3 veces al día.
3. Respirar profundo y toser con cuidado (sujetando el tórax con una almohada) para evitar complicaciones pulmonares.
4. Analgesia horaria según receta (el dolor suele durar 2-3 semanas).`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_trauma_06",
      title: "Cervicalgia / Tortícolis",
      content: `INDICACIONES - DOLOR CERVICAL TENSIONAL
1. Calor local en cuello y hombros (guatero de semillas) por 20 min.
2. Pausas activas y estiramientos suaves de cuello durante el trabajo.
3. Corregir altura de pantalla del computador y almohada al dormir.
4. Relajante muscular en la noche según indicación médica.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_trauma_07",
      title: "Epicondilitis (Codo de Tenista)",
      category: "indication",
      content: `INDICACIONES - EPICONDILITIS
1. Evitar movimientos de repetición de muñeca/codo (destornillar, planchar).
2. Uso de Codera de Tenista (Brazalete) 2 cm bajo el codo durante actividad.
3. Hielo local 15 min tras esfuerzo.
4. Ejercicios de elongación de extensores de muñeca.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_trauma_08",
      title: "Síndrome Túnel Carpiano",
      category: "indication",
      content: `INDICACIONES - TÚNEL CARPIANO
1. Uso de férula (muñequera) rígida nocturna para dormir (mantiene la muñeca neutra).
2. Pausas activas con ejercicios de muñeca.
3. Vitamina B6 (si se indicó).
4. Evitar dormir con las muñecas flectadas.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_trauma_09",
      title: "Gonartrosis (Artrosis Rodilla)",
      category: "indication",
      content: `INDICACIONES - ARTROSIS DE RODILLA
1. Bajar de peso (fundamental para disminuir carga articular).
2. Evitar subir/bajar escaleras en exceso.
3. Fortalecer cuádriceps (muslo) con ejercicios sentados.
4. Uso de bastón en mano contraria a rodilla dolorosa si hay cojera.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_trauma_10",
      title: "Tenosinovitis De Quervain",
      category: "indication",
      content: `INDICACIONES - TENDINITIS MUÑECA (DE QUERVAIN)
1. Evitar uso excesivo del pulgar (chatear en celular).
2. Uso de inmovilizador de pulgar (Spica) por 2 semanas.
3. Hielo local en base del pulgar.
4. Kinesiología y Terapia Ocupacional.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // SALUD MENTAL
   // =========================================================================
   {
      id: "tpl_mental_01",
      title: "Higiene del Sueño",
      content: `RECOMENDACIONES PARA INSOMNIO
1. Horarios fijos para acostarse y levantarse.
2. Habitación oscura y sin ruido.
3. Cero pantallas 1 hora antes de dormir.
4. No consumir café/té después de las 17:00 hrs.
5. Si no duerme en 20 min, levántese y haga algo aburrido hasta tener sueño. NO usar celular en cama.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "trastorno-ansiedad",
      title: "Trastorno de Ansiedad",
      content: `INDICACIONES - MANEJO DE ANSIEDAD
1. Técnicas de respiración diafragmática (pausada y profunda) en momentos de crisis.
2. Evitar estimulantes (cafeína, bebidas energéticas, alcohol).
3. Ejercicio físico aeróbico regular (mejora síntomas ansiosos).
4. Mantener rutinas diarias organizadas.
5. Consulta salud mental / psicoterapia.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "depresion-leve",
      title: "Depresión Leve / Ánimo Bajo",
      content: `INDICACIONES - ACTIVACIÓN CONDUCTUAL
1. "Hacer para sentir, no esperar sentir para hacer": Retomar actividades gradualmente aunque no haya ganas.
2. Caminata diaria de 30 minutos (luz solar ayuda al ánimo).
3. No aislarse: Mantener contacto con familia/amigos.
4. Higiene del sueño estricta.
5. Adherencia total a tratamiento farmacológico si se indicó.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_mental_04",
      title: "Crisis de Pánico",
      content: `INDICACIONES - CRISIS DE PÁNICO
1. Recordar: "Esto es una crisis de ansiedad, es muy desagradable pero NO ES PELIGROSO y va a pasar en unos minutos".
2. Respiración en bolsa de papel o manos ahuecadas (lenta y profunda).
3. Enfocarse en estímulos externos (nombrar 5 objetos que ve, 4 que puede tocar...).
4. No huir del lugar, esperar que la ansiedad baje sola.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_mental_05",
      title: "Burnout / Estrés Laboral",
      content: `INDICACIONES - ESTRÉS LABORAL
1. Delimitar estrictamente horario laboral y personal (desconexión digital).
2. Pausas activas cada 90 minutos.
3. Retomar hobbies y actividades placenteras fuera del trabajo.
4. Evaluar licencia médica si síntomas son incapacitantes.
5. Psicoterapia con enfoque laboral.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_mental_06",
      title: "Duelo",
      category: "indication",
      content: `INDICACIONES - PROCESO DE DUELO
1. Validar las emociones: Es normal sentir tristeza, rabia o culpa. No reprimirlas.
2. Mantener rutinas básicas (comer, ducharse, levantarse).
3. No tomar decisiones importantes (vender casa, renunciar) en los primeros meses.
4. Grupos de apoyo o terapia si el duelo se vuelve patológico (> 6 meses o incapacitante).`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_mental_07",
      title: "Consumo de Alcohol (Consejería)",
      category: "indication",
      content: `INDICACIONES - REDUCCIÓN CONSUMO ALCOHOL
1. Evitar tener alcohol en casa.
2. Alternar tragos con bebidas sin alcohol o agua.
3. Definir días "Libres de Alcohol" en la semana.
4. Buscar apoyo familiar.
5. Si presenta temblor o ansiedad al no beber -> Consultar urgente.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_mental_08",
      title: "Autoestima y Autocuidado",
      category: "indication",
      content: `INDICACIONES - AUTOCUIDADO
1. Reservar 30 min diarios exclusivamente para Ud. (baño tina, lectura, caminata).
2. Aprender a decir "NO" sin culpa.
3. Lista de gratitud: Anotar 3 cosas buenas del día cada noche.
4. Reducir autocrítica destructiva.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_mental_09",
      title: "Crisis de Angustia / Ejercicios",
      category: "indication",
      content: `EJERCICIO DE RESPIRACIÓN (4-7-8)
1. Bote todo el aire.
2. Tome aire por la nariz contando hasta 4.
3. Aguante el aire contando hasta 7.
4. Bote el aire por la boca contando hasta 8.
5. Repetir el ciclo 4 veces.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_mental_10",
      title: "Consejería Tabaquismo",
      category: "indication",
      content: `INDICACIONES - CESE DE TABACO
1. Fijar "Día D" para dejar de fumar.
2. Eliminar ceniceros y encendedores de casa.
3. Identificar gatillantes (café, alcohol, estrés) y tener plan B (vaso de agua, chicle sin azúcar).
4. El deseo intenso dura solo 3-5 minutos: Distraerse.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // GASTROENTEROLOGÍA
   // =========================================================================
   {
      id: "tpl_gastro_01",
      title: "Gastroenteritis Aguda",
      content: `INDICACIONES - RÉGIMEN LIVIANO
1. Hidratación: Agua cocida, suero oral o bebidas isotónicas (a sorbos).
2. COMER: Arroz blanco, pollo cocido, jalea, galletas de soda, pan tostado.
3. EVITAR: Lácteos, frituras, verduras crudas, frutas (excepto manzana cocida), alcohol y condimentos.
4. Probióticos según indicación.
5. Consultar si: Vómitos no paran, sangre en deposiciones o deshidratación.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_gastro_rge",
      title: "Reflujo Gastroesofágico (RGE)",
      content: `INDICACIONES - REFLUJO
1. Última comida 3 horas antes de acostarse.
2. Elevar la cabecera de la cama 15-20 cm (bocks en las patas de la cabecera).
3. EVITAR: Café, menta, chocolate, grasas, frituras, alcohol, tabaco, picantes.
4. Comer lento y porciones pequeñas.
5. Bajar de peso si corresponde.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_gastro_ii",
      title: "Colon Irritable / SII",
      content: `INDICACIONES - SÍNDROME INTESTINO IRRITABLE
1. Identificar alimentos gatillantes (lácteos, trigo, legumbres, repollo/coliflor).
2. Dieta FODMAP bajo supervisión nutricional puede ayudar.
3. Manejo del estrés (factor clave).
4. Comer fibra soluble (avena, psyllium) y abundante agua.
5. Antiespasmódicos si hay dolor (según receta).`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_gastro_constip",
      title: "Estreñimiento Crónico",
      content: `INDICACIONES - ESTREÑIMIENTO
1. Aumentar Fibra: Frutas con cáscara, verduras, legumbres, avena, semillas de linaza/chía.
2. Líquidos: Mínimo 2 litros de agua al día.
3. Actividad física (moviliza el intestino).
4. Crear hábito: Ir al baño siempre a la misma hora, sin apuro, usar pisos bajo los pies (posición de cuclillas).
5. No abusar de laxantes estimulantes.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_gastro_h_pilori",
      title: "Erradicación Helicobacter Pylori",
      content: `INDICACIONES - TRATAMIENTO H. PYLORI
1. Es fundamental tomar los antibióticos y el protector gástrico TODOS los días, en los horarios indicados, por 14 días completos.
2. No suspender aunque se sienta bien o sienta sabor metálico/molestias leves.
3. Régimen liviano sin irritantes.
4. Suspender tabaco y alcohol.
5. Control médico al finalizar confirmar erradicación (test de aire o antígeno deposición en 4 semanas post término).`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_gastro_06",
      title: "Gastritis Aguda",
      category: "indication",
      content: `INDICACIONES - GASTRITIS
1. Suspender: AINES (Ibuprofeno, Ketorolaco, Aspirina), Alcohol, Tabaco, Café, Picantes.
2. Régimen blando sin residuos.
3. Comer en horarios ordenados.
4. Uso de Omeprazol/Lansoprazol en ayunas según indicación.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_gastro_07",
      title: "Hígado Graso",
      category: "indication",
      content: `INDICACIONES - ESTEATOSIS HEPÁTICA (HÍGADO GRASO)
1. Cero Alcohol (el hígado debe sanar).
2. Reducir fructosa (bebidas, jugos de fruta concentrados).
3. Bajar 10% del peso corporal gradualmente.
4. Ejercicio físico es el mejor medicamento.
5. Evitar suplementos naturales de dudosa procedencia (pueden ser tóxicos).`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_gastro_08",
      title: "Hemorragia Digestiva Alta (Alarma)",
      category: "indication",
      content: `INDICACIONES - ALTA POST HEMORRAGIA DIGESTIVA
1. Si presenta deposiciones negras como alquitrán (melena) o vómitos con sangre -> IR A URGENCIA INMEDIATAMENTE.
2. No tomar Antiinflamatorios nunca más (salvo indicación médica estricta).
3. Régimen blando estricto por 1 semana.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_gastro_09",
      title: "Meteorismo (Gases)",
      category: "indication",
      content: `INDICACIONES - METEORISMO
1. No mascar chicle ni tomar bebidas con gas.
2. Comer despacio y sin hablar.
3. Evitar: Repollo, coliflor, legumbres sin remojar, alcachofa, cebolla cruda.
4. Uso de Simeticona (Gasorbol) si indicación médica.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_gastro_10",
      title: "Diverticulosis (Sin inflamación)",
      category: "indication",
      content: `INDICACIONES - DIVERTICULOSIS DEL COLON
1. Aumentar consumo de Fibra (Salvado de trigo, avena, frutas, verduras) para evitar estreñimiento.
2. Tomar 2 litros de agua diarios.
3. Evitar semillas pequeñas (tomate, kiwi, frutillas) si nota molestias (aunque no está 100% prohibido, observar tolerancia).`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // METABÓLICO / MEDICINA INTERNA
   // =========================================================================
   {
      id: "tpl_meta_dm2",
      title: "Diabetes Tipo 2",
      content: `INDICACIONES - DIABETES MELLITUS
1. Dieta baja en Hidratos de Carbono simples (azúcar, harinas blancas, dulces, bebidas).
2. Preferir integrales y verduras.
3. Caminata 30 min/día (mejora sensibilidad insulina).
4. Cuidado de pies: Revisar diario, calzado cómodo, no andar descalzo, corte de uñas recto.
5. Controles periódico HbA1c y Fondo de Ojo anual.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_meta_hta",
      title: "Hipertensión Arterial",
      content: `INDICACIONES - HIPERTENSIÓN (HTA)
1. Dieta Hiposódica: Cero salero en mesa, evitar embutidos, conservas, pan en exceso.
2. Bajar de peso si hay obesidad.
3. Ejercicio aeróbico regular.
4. Medicamentos: Tomar diariamente, no suspender aunque la presión esté "normal".
5. Si presión > 180/110 con síntomas (dolor pecho, falta aire, dolor cabeza intenso) -> Urgencia.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_meta_dlp",
      title: "Dislipidemia",
      content: `INDICACIONES - COLESTEROL ALTO
1. Reducir Grasas Saturadas: Carnes rojas grasas, embutidos, quesos amarillos, mantequilla, frituras, pastelería.
2. Preferir Grasas Buenas: Aceite de oliva crudo, palta (moderado), nueces, pescado (omega 3).
3. Aumentar fibra (avena, verduras).
4. Ejercicio físico.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_meta_gota",
      title: "Gota (Ácido Úrico)",
      content: `INDICACIONES - GOTA AGUDA / HIPERURICEMIA
1. PROHIBIDO: Alcohol (especialmente cerveza y destilados), mariscos, vísceras, carnes rojas excesivas, bebidas con fructosa.
2. Hidratación abundante.
3. En crisis: Reposo, frío local, antiinflamatorios. No iniciar Alopurinol en plena crisis.
4. Bajar de peso gradualmente.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_med_itu",
      title: "Infección Urinaria (ITU)",
      content: `INDICACIONES - CISTITIS / ITU
1. Antibiótico según receta (completar días).
2. Abundante líquido (agua).
3. Orinar frecuente (no aguantar).
4. Aseo genital de adelante hacia atrás.
5. Consultar si: Fiebre alta, dolor lumbar intenso o vómitos (posible pielonefritis).`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_meta_hipotiro",
      title: "Hipotiroidismo",
      category: "indication",
      content: `INDICACIONES - HIPOTIROIDISMO (EUTIROX)
1. Tomar Levotiroxina (Eutirox) en ayunas estricta con agua.
2. Esperar 30-60 minutos antes de tomar desayuno.
3. Separar 4 horas de suplementos de Calcio, Hierro o Antiácidos.
4. Control TSH en 6-8 semanas tras cambio de dosis.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_meta_anemia",
      title: "Anemia Ferropriva",
      category: "indication",
      content: `INDICACIONES - ANEMIA (HIERRO)
1. Tomar suplemento de Hierro con jugo de naranja o limonada (Vitamina C mejora absorción).
2. NO tomar con té, café, leche o antiácidos (bloquean la absorción).
3. Aumentar consumo de: Carnes rojas, legumbres, acelga/espinaca.
4. Las deposiciones pueden ponerse negras (es normal).`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_meta_obesidad",
      title: "Obesidad y Sobrepeso",
      category: "indication",
      content: `INDICACIONES - MANEJO PESO CORPORAL
1. No saltarse desayunos.
2. "Plato Saludable": 1/2 verduras, 1/4 proteína, 1/4 carbohidrato.
3. Evitar "grasa líquida" (bebidas con azúcar, jugos, alcohol).
4. Comer sentado y sin TV.
5. Meta inicial: Bajar 5-10% del peso en 6 meses.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_meta_vitd",
      title: "Déficit Vitamina D",
      category: "indication",
      content: `INDICACIONES - VITAMINA D
1. Tomar suplemento según indicación (dosis de carga o mantención).
2. Exposición solar segura: 15 min en brazos/piernas antes de las 11:00 o después de las 16:00 (sin bloqueador en ese rato).
3. Alimentos: Pescados grasos (salmón, atún), huevo, lácteos fortificados.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_meta_osteop",
      title: "Osteoporosis / Osteopenia",
      category: "indication",
      content: `INDICACIONES - SALUD ÓSEA
1. Consumo de Lácteos: 3 porciones al día (Leche, yogurt, quesillo).
2. Caminata diaria al aire libre (sol activa Vitamina D).
3. Evitar caídas: Retirar alfombras sueltas, usar luz nocturna, instalar barras en baño.
4. Calcio + Vitamina D según receta.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // CIRUGÍA / PROCEDIMIENTOS
   // =========================================================================
   {
      id: "cuidados-posoperatorios-corte",
      title: "Cuidados Herida Operatoria",
      content: `INDICACIONES - CUIDADO HERIDA
1. Mantener limpia y seca.
2. Curación diaria simple (suero fisiológico o agua cocida).
3. Vigilancia: Si hay pus, rojo vivo, calor o fiebre -> Consultar.
4. Retiro de puntos según indicación (usualmente 7-14 días).`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_cir_cole",
      title: "Colelitiasis (Cálculos Vesícula)",
      content: `INDICACIONES - CÁLCULOS A LA VESÍCULA
1. DIETA "CERO GRASA": Fundamental para evitar cólicos.
   - Prohibido: Frituras, palta, yema de huevo, mayonesa, crema, quesos, chocolate, carne grasa, embutidos.
   - Permitido: Carnes magras, verduras, frutas, arroz, fideos, mermelada, miel.
2. Si presenta dolor intenso persistente tras comer grasas + vómitos o fiebre -> Urgencia.
3. Programar cirugía (Colecistectomía) a la brevedad.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_cir_hernia",
      title: "Hernia Inguinal/Abdominal",
      content: `INDICACIONES - HERNIA
1. Evitar fuerzas: No levantar objetos pesados, no pujar excesivamente al ir al baño (tratar estreñimiento).
2. Control de peso.
3. Uso de faja abdominal si da alivio (transitorio).
4. Signo de Alarma (Estrangulada): Si la hernia se pone dura, muy dolorosa, roja y no entra al acostarse -> Urgencia Inmediata.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_cir_onico",
      title: "Onicocriptosis (Uña encarnada)",
      content: `INDICACIONES - UÑA ENCARNADA
1. Aseo diario con agua y jabón.
2. Baños de pies con agua tibia y sal 2 veces al día.
3. Uso de calzado amplio.
4. Corte de uñas RECTO, nunca redondear las puntas.
5. Antibiótico tópico o sistémico si hay infección activa.`,
      category: "indication",
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_cir_absceso",
      title: "Drenaje Absceso/Forúnculo",
      category: "indication",
      content: `INDICACIONES - DRENAJE ABSCESO
1. Retirar gasa/mecha en 24-48 horas según indicación.
2. Curaciones diarias en enfermería o casa (lavar con agua, cubrir con gasa limpia).
3. No apretar la zona.
4. Antibiótico si fue recetado.
5. Si vuelve a acumular pus, consultar.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_cir_hemorroides",
      title: "Hemorroides",
      category: "indication",
      content: `INDICACIONES - HEMORROIDES (CRISIS)
1. Baños de asiento con agua tibia (o manzanilla) por 10 min, 3 veces al día.
2. Evitar estreñimiento (mucha fibra y agua). No pujar.
3. No usar papel higiénico áspero (lavarse o usar toallas húmedas).
4. Cremas/Supositorios antihemorroidales por máximo 5-7 días.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_cir_quemadura",
      title: "Quemadura Leve (Tipo A)",
      category: "indication",
      content: `INDICACIONES - QUEMADURA SUPERFICIAL
1. Hidratar la piel con vaselina o crema sin perfume varias veces al día.
2. Proteger del sol (bloqueador solar factor 50+ por 6 meses) para evitar manchas.
3. No reventar ampollas si aparecen.
4. Analgesia si dolor.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_cir_lipoma",
      title: "Post-Extirpación Lipoma/Quiste",
      category: "indication",
      content: `INDICACIONES - CIRUGÍA MENOR (LIPOMA/QUISTE)
1. Reposo relativo 24 horas.
2. No mojar parche por 48 horas.
3. Retiro de puntos en 7-10 días.
4. Signos de infección: dolor creciente, calor local.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_cir_varices",
      title: "Várices (Manejo Conservador)",
      category: "indication",
      content: `INDICACIONES - VÁRICES MIEMBROS INFEIORES
1. Uso de medias elásticas compresivas durante el día.
2. No estar de pie o sentado quieto por > 1 hora.
3. Elevar piernas al descansar (sobre nivel del corazón).
4. Bajar de peso y ejercicio (caminata).`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_cir_puntos",
      title: "Cuidados tras Retiro de Puntos",
      category: "indication",
      content: `INDICACIONES - POST RETIRO DE PUNTOS
1. La cicatriz aún es débil. No traccionar la piel.
2. Hidratación con crema cicatrizante 2 veces al día.
3. Masaje suave sobre la cicatriz (cuando no duela) para evitar adherencias.
4. Protección solar TOTAL (parche o bloqueador) por 6-12 meses para que no se oscurezca.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // CERTIFICADOS (GLOBALES)
   // =========================================================================
   {
      id: "tpl_cert_01",
      title: "Alta Médica",
      category: "certificate",
      content: `CERTIFICADO DE ALTA MÉDICA

Certifico que el paciente, tras completar su control médico, se encuentra en condiciones de retomar sus actividades habituales / laborales / escolares a partir del día: ___/___/_____.

Se extiende el presente a petición del interesado.

Atentamente,`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_cert_02",
      title: "Certificado de Alumno Regular (Salud)",
      category: "certificate",
      content: `CERTIFICADO DE SALUD COMPATIBLE

Certifico que tras el examen físico realizado hoy, el paciente se encuentra clínicamente sano(a) y con salud compatible para realizar actividad física escolar.

Atentamente,`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "tpl_cert_03",
      title: "Reposo Médico (Colegio/Trabajo)",
      category: "certificate",
      roles: ["MEDICO"],
      content: `CERTIFICADO DE REPOSO MÉDICO

Certifico que el paciente debe guardar REPOSO MÉDICO en su domicilio por un periodo de _____ días, a contar del día ___/___/_____, debido al cuadro clínico diagnosticado.

Se extiende el presente para ser presentado ante su empleador / establecimiento educacional.

Atentamente,`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   // --- KINESIOLOGÍA ---
   {
      id: "kine-escoliosis",
      title: "Escoliosis - Ejercicios",
      content: "1. Flexibilización de columna (Gato-Camello) 3x10.\n2. Estiramiento de cadena posterior.\n3. Fortalecimiento de musculatura paravertebral (Superman) 3x10 seg.\n4. Ejercicios de Klapp según tolerancia.\n5. Reeducación postural frente espejo.",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Columna", "Musculoesquelética"]
   },
   {
      id: "kine-esguince",
      title: "Esguince de Tobillo - Fase Inicial",
      content: "1. Reposo relativo + Hielo (Crioterapia) 15 min cada 4 horas.\n2. Elevación de extremidad.\n3. Compresión elástica suave.\n4. Movilidad activa de dedos.\n5. Carga según tolerancia con bastón si es necesario.",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Musculoesquelética EE.II", "Traumatología"]
   },
   {
      id: "kine-artrosis-cadera",
      title: "Artrosis de Cadera - Manejo",
      content: "1. Bicicleta estática sin carga 10-15 min.\n2. Fortalecimiento de glúteo medio (abducciones acostado).\n3. Puentes de glúteo 3x10.\n4. Evitar impacto y cargas axiales excesivas.\n5. Calor local en zona de dolor crónico.",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Musculoesquelética EE.II", "Geriatría"]
   },
   {
      id: "kine-artrosis-rodilla",
      title: "Artrosis de Rodilla - Fortalecimiento",
      content: "1. Isométricos de cuádriceps (apretar toalla bajo rodilla) 10 rep x 10 seg.\n2. Elevación de pierna recta (SLR) 3x10.\n3. Flexo-extensión de rodilla sentado.\n4. Caminatas cortas en terreno plano.\n5. Uso de buen calzado con amortiguación.",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Musculoesquelética EE.II", "Geriatría"]
   },
   {
      id: "kine-meniscos",
      title: "Patología de Meniscos - Conservador",
      content: "1. Evitar flexión profunda de rodilla (>90 grados).\n2. Fortalecimiento de cuádriceps e isquiotibiales sin carga.\n3. Propiocepción en apoyo unipodal (según dolor).\n4. Hielo post-ejercicio si hay inflamación.",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Musculoesquelética EE.II", "Traumatología"]
   },
   {
      id: "kine-manguito",
      title: "Sd. Manguito Rotador - Ejercicios",
      content: "1. Pendulares de Codman 2 min.\n2. Isometricos de rotación externa e interna contra pared.\n3. Movilidad asistida con bastón (flexión hasta tolerancia).\n4. Evitar movimientos sobre la cabeza (overhead).\n5. Hielo local 15 min si hay dolor nocturno.",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Musculoesquelética EE.SS", "Traumatología"]
   },
   {
      id: "kine-lumbago",
      title: "Lumbago Mecánico - Pautas",
      content: "1. Calor local 20 min en zona lumbar.\n2. Estiramientos suaves de glúteos e isquiotibiales.\n3. Ejercicios de Williams (flexión) o Mckenzie (extensión) según evaluación.\n4. Higiene postural al sentarse y levantar cargas.\n5. Caminata suave según tolerancia.",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Columna", "Traumatología"]
   },
   {
      id: "kine-dorsalgia",
      title: "Dorsalgia / Postural",
      content: "1. Movilidad de columna dorsal (rotaciones sentado).\n2. Estiramiento de pectorales en marco de puerta.\n3. Fortalecimiento de romboides (retracción escapular).\n4. Reeducación postural en puesto de trabajo (ergonomía).",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Columna", "Postura"]
   },
   {
      id: "kine-lumbociatica",
      title: "Sd. Lumbociático - Agudo",
      content: "1. Reposo relativo (evitar cama prolongada).\n2. Neurodinamia deslizante suave de nervio ciático.\n3. Calor húmedo lumbar.\n4. Posturas de descarga (decúbito lateral con almohada entre piernas).",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Columna", "Neurología"]
   },
   {
      id: "kine-cervicobraquialgia",
      title: "Cervicobraquialgia",
      content: "1. Movilidad cervical suave (no forzar rangos dolorosos).\n2. Estiramiento de trapecio superior y elevador de la escápula.\n3. Neurodinamia de nervio mediano/radial/ulnar según síntoma.\n4. Calor local zona cervical.\n5. Ajuste de altura de almohada.",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Columna", "Musculoesquelética EE.SS"]
   },
   {
      id: "kine-tunel-carpiano",
      title: "Sd. Túnel Carpiano",
      content: "1. Estiramiento de flexores de muñeca y dedos.\n2. Neurodinamia de nervio mediano.\n3. Uso de férula nocturna si está indicada.\n4. Evitar movimientos repetitivos de agarre fuerte.\n5. Crioterapia en muñeca 10 min.",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Musculoesquelética EE.SS", "Laboral"]
   },
   {
      id: "kine-marcha",
      title: "Trastorno de la Marcha - Reeducación",
      content: "1. Marcha en pasarelas con obstáculos.\n2. Entrenamiento de fases de marcha (choque talón, despegue).\n3. Equilibrio estático y dinámico.\n4. Fortalecimiento de abductores de cadera y tríceps sural.\n5. Uso correcto de ayudas técnicas (bastón/andador).",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Musculoesquelética EE.II", "Neurología"]
   },
   {
      id: "kine-tren-sup",
      title: "Fortalecimiento Tren Superior",
      content: "1. Flexo-extensión de codos (push-ups pared o suelo) 3x10.\n2. Remo con banda elástica (tracción) 3x12.\n3. Press de hombro con peso ligero 3x10.\n4. Bíceps/tríceps con mancuerna/banda.",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Musculoesquelética EE.SS", "Deporte"]
   },
   {
      id: "kine-tren-inf",
      title: "Fortalecimiento Tren Inferior",
      content: "1. Sentadillas (Squats) a 90 grados 3x12.\n2. Estocadas (Lunges) estáticas o dinámicas 3x10 por pierna.\n3. Elevación de talones (Calf raises) 3x15.\n4. Abducción de cadera con banda elástica.\n5. Puente de glúteo monopodal si es posible.",
      category: "indication",
      roles: ["KINESIOLOGO", "MEDICO"],
      tags: ["Musculoesquelética EE.II", "Deporte"]
   },
   // =========================================================================
   // ENFERMERÍA / TENS
   // =========================================================================
   {
      id: "enfer_curacion",
      title: "Curación de Herida / Sutura",
      category: "indication",
      roles: ["ENFERMERA", "TENS", "MEDICO"],
      tags: ["Enfermería", "Procedimiento"],
      content: `REGISTRO DE CURACIÓN:
1. Lavado con suero fisiológico.
2. Bordes: Afrontados / Eritematosos / Macerados.
3. Exudado: Escaso / Moderado / Seroso / Purulento.
4. Tejido: Granulatorio / Esfacelo / Necrótico.
5. Insumos: Gasa no adherente, apósito secundario.
PRÓXIMA CURACIÓN: En [ ] días.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "enfer_inyectable",
      title: "Administración de Inyectable",
      category: "indication",
      roles: ["ENFERMERA", "TENS"],
      tags: ["Enfermería", "Inyectable"],
      content: `PROCEDIMIENTO INYECTABLE:
- Medicamento: [ ]
- Vía: IM (Deltoides / Glúteo) / EV / SC.
- Tolerancia: Buena / Sin incidentes.
- Observaciones: Se educa sobre posibles efectos adversos o dolor local.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // NUTRICIÓN
   // =========================================================================
   {
      id: "nutri_pauta_gen",
      title: "Pauta Alimentaria General Saludable",
      category: "indication",
      roles: ["NUTRICIONISTA"],
      tags: ["Nutrición"],
      content: `INDICACIONES NUTRICIONALES GENERALES:
1. Consumo de agua: 6-8 vasos al día.
2. Frutas y Verduras: 5 porciones de distintos colores diariamente.
3. Evitar: Azúcares refinadas, bebidas azucaradas, frituras y exceso de sal.
4. Horarios: Mantener 4 comidas principales bajando el volumen en la noche.
5. Actividad Física: 30 minutos de caminata a paso rápido.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "nutri_pauta_cho",
      title: "Pauta Control Hidratos (Diabetes)",
      category: "indication",
      roles: ["NUTRICIONISTA", "MEDICO"],
      tags: ["Nutrición", "Diabetes"],
      content: `PLAN NUTRICIONAL PARA DIABETES / RESISTENCIA INSULINA:
- Reemplazar harinas blancas por integrales.
- Fruta: Máximo 2-3 unidades medianas al día, evitar jugos (consumir entera).
- Proteína: Aumentar consumo de legumbres, pescado y carnes blancas.
- Distribución CHO: [ ] porciones al desayuno, [ ] almuerzo, [ ] once.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // PSICOLOGÍA
   // =========================================================================
   {
      id: "psico_encuadre",
      title: "Encuadre Terapéutico",
      category: "indication",
      roles: ["PSICOLOGO"],
      tags: ["Psicología"],
      content: `ENCUADRE TERAPÉUTICO:
1. Frecuencia de sesiones: [Semanal / Bisemanal].
2. Duración: 45-50 minutos.
3. Política de cancelación: Avisar con 24 hrs de antelación.
4. Confidencialidad: Se mantiene reserva de todo lo conversado salvo riesgo vital.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "psico_autoestima",
      title: "Pauta Autocuidado y Autoestima",
      category: "indication",
      roles: ["PSICOLOGO"],
      tags: ["Psicología", "Autocuidado"],
      content: `SUGERENCIAS DE AUTOCUIDADO:
1. Identificar 3 logros diarios (por pequeños que sean).
2. Espacio de silencio: 15 min al día sin pantallas.
3. Validar emociones: "Es válido sentirse así en este momento".
4. Límites: Practicar decir que no en situaciones de baja ansiedad.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // PODOLOGÍA
   // =========================================================================
   {
      id: "podo_pie_diabetico",
      title: "Evaluación Pie Diabético",
      category: "indication",
      roles: ["PODOLOGO", "ENFERMERA", "MEDICO"],
      tags: ["Podología", "Diabetes"],
      content: `EVALUACIÓN PIE DIABÉTICO:
1. Sensibilidad (Monofilamento): Conservada / Disminuida.
2. Pulsos Pedios: Presentes / Ausentes.
3. Integridad de la piel: Sin lesiones / Úlcera grado [ ].
4. Uñas: Onicomicosis / Onicocriptosis.
INDICACIONES: Lavado diario, secado prolijo entre dedos, no caminar descalzo.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "podo_onicocriptosis",
      title: "Tratamiento Onicocriptosis (Uña Encarnada)",
      category: "indication",
      roles: ["PODOLOGO"],
      tags: ["Podología"],
      content: `PROCEDIMIENTO ONICOCRIPTOSIS:
- Dedo afectado: [ ]
- Técnica: Resección en espícula / Técnica de espiculotomía.
- Curación: Curación oclusiva con antiséptico.
- Evolución: Dolor disminuye post-procedimiento.
INDICACIONES: No mojar parche por 24 hrs, acudir a control en [ ] días.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // ASISTENTE SOCIAL
   // =========================================================================
   {
      id: "social_informe",
      title: "Estructura Informe Social",
      category: "indication",
      roles: ["ASISTENTE_SOCIAL"],
      tags: ["Social"],
      content: `SÍNTESIS INFORME SOCIAL:
1. SITUACIÓN FAMILIAR: Composición y dinámica.
2. SITUACIÓN ECONÓMICA: Ingreso per cápita, fuentes de ingreso.
3. VIVIENDA: Tenencia, materialidad, servicios básicos.
4. SALUD: Acceso a red, adherencia a tratamientos.
5. DIAGNÓSTICO SOCIAL: Factores de riesgo y protectores.
6. PLAN DE INTERVENCIÓN: Derivación a red comunitaria / Subsidios.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // PREPARADOR FÍSICO
   // =========================================================================
   {
      id: "prep_eval_inicial",
      title: "Evaluación Condición Física Inicial",
      category: "indication",
      roles: ["PREPARADOR_FISICO", "KINESIOLOGO"],
      tags: ["Deporte"],
      content: `EVALUACIÓN INICIAL PF:
1. TEST FUERZA: (Ej: Flexoextensión de brazos en 1 min) [ ]
2. TEST CARDIO: (Ej: Test de Ruffier) [ ]
3. FLEXIBILIDAD: (Ej: Sit and Reach) [ ]
4. COMPOSICIÓN: % Grasa [ ], % Músculo [ ].
OBJETIVOS: [Hipertrofia / Resistencia / Pérdida de grasa].`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // QUÍMICO FARMACÉUTICO
   // =========================================================================
   {
      id: "farm_conciliacion",
      title: "Conciliación Farmacéutica",
      category: "indication",
      roles: ["QUIMICO_FARMACEUTICO"],
      tags: ["Farmacia"],
      content: `CONCILIACIÓN MEDICAMENTOSA:
- Medicamentos actuales: [ ]
- Duplicidades detectadas: [ ]
- Interacciones detectadas: [ ]
- Alergias declaradas: [ ]
PLAN: Educación sobre horarios, aclaración de dudas, reporte a médico tratante.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // TECNÓLOGO MÉDICO
   // =========================================================================
   {
      id: "tm_impresion_tec",
      title: "Impresión Técnica (Imagen/Lab)",
      category: "indication",
      roles: ["TECNOLOGO_MEDICO"],
      tags: ["Tecnología Médica"],
      content: `REGISTRO PROCEDIMIENTO TM:
- Examen realizado: [ ]
- Calidad técnica: Adecuada / Con artefactos.
- Hallazgos técnicos relevantes: [ ]
- Observaciones: El examen se envía a médico radiólogo/patólogo para informe definitivo.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },

   // =========================================================================
   // EDUCACIÓN Y RECOMENDACIONES (MULTIDISCIPLINARIO)
   // =========================================================================
   {
      id: "edu_pie_diabetico",
      title: "EDU: Prevención y Autocuidado de Pies (MINSAL)",
      category: "indication",
      roles: ["MEDICO", "ENFERMERA", "PODOLOGO", "TENS", "NUTRICIONISTA"],
      tags: ["Educación", "Diabetes", "Chile APS"],
      content: `RECOMENDACIONES PARA EL AUTOCUIDADO DE SUS PIES (Norma MINSAL):
1. INSPECCIÓN DIARIA: Revise sus pies todos los días buscando cortes, ampollas, manchas rojas o inflamación. Use un espejo para ver la planta.
2. LAVADO: Use agua tibia (siempre pruebe la temperatura con el CODO) y jabón neutro. No remojar por más de 5 minutos.
3. SECADO: Seque cuidadosamente, poniendo especial énfasis ENTRE LOS DEDOS, sin frotar.
4. HUMECTACIÓN: Use crema humectante en el dorso y planta del pie. NUNCA ponga crema entre los dedos (evita maceración y hongos).
5. CALZADO: Nunca ande descalzo, ni siquiera en casa. Revise el interior del zapato antes de ponérselo por si hay piedrecitas o costuras sueltas.
6. CALCETINES: Use calcetines de fibra natural (algodón/lana), sin costuras y que no aprieten la pierna.
CONSULTE URGENTE SI: Nota mal olor, cambios de color (zona negra o azul), aumento de temperatura local o una herida que no cicatriza.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "edu_calzado",
      title: "EDU: Selección de Calzado Saludable",
      category: "indication",
      roles: ["MEDICO", "ENFERMERA", "PODOLOGO", "KINESIOLOGO", "TERAPEUTA_OCUPACIONAL"],
      tags: ["Educación", "Prevención"],
      content: `CRITERIOS PARA COMPRA DE CALZADO (Podología Preventiva):
1. HORARIO: Compre sus zapatos al final del tarde, cuando sus pies están más dilatados.
2. TAMAÑO: Debe existir un espacio de 1 a 1.5 cm entre el dedo más largo y la punta.
3. PUNTA: Siempre redondeada o cuadrada para permitir el libre movimiento de los dedos (evitar puntas "en letra").
4. MATERIAL: Preferir cuero suave o tela que permita la ventilación. Evite plásticos.
5. SUELA: De goma, flexible y antideslizante para evitar caídas.
6. SUJECIÓN: El zapato debe ser firme al talón y preferir cierre con cordones o velcro para ajustar según hinchazón.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "edu_psicomotriz",
      title: "EDU: Estimulación Temprana (Chile Crece Contigo)",
      category: "indication",
      roles: ["ENFERMERA", "KINESIOLOGO", "MATRONA", "TERAPEUTA_OCUPACIONAL"],
      tags: ["Educación", "Pediatría", "CHCC"],
      content: `RECOMENDACIONES DE ESTIMULACIÓN EN EL HOGAR (0-12 meses):
1. TUMMY TIME: Coloque al bebé boca abajo sobre una superficie firme mientras esté despierto y vigilado (fortalece musculatura para el gateo).
2. INTERACCIÓN: Háblele de frente, cambie de tonos de voz y responda a sus balbuceos (fomenta el lenguaje).
3. SEGUIMIENTO: Use objetos de colores contrastantes (rojo, blanco, negro) para que los siga con la mirada.
4. LIBERTAD: Use ropa cómoda y evite el uso excesivo de "andadores" o "saltadores" que limitan el desarrollo motor natural.
5. JUEGO: Permítale explorar distintas texturas y llevarse objetos seguros a la boca.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "nutri_reg_diabetico_adv",
      title: "EDU: Alimentación en Diabetes (Red Crónicos)",
      category: "indication",
      roles: ["NUTRICIONISTA", "MEDICO", "ENFERMERA"],
      tags: ["Nutrición", "Diabetes", "Chile APS"],
      content: `GUÍA ALIMENTARIA PARA PERSONAS CON DIABETES:
1. FRACCIONAMIENTO: Mantenga horarios de comida regulares para evitar bajas de azúcar (hipoglucemias).
2. REEMPLAZO: Cambie el pan blanco por pan integral o marraqueta (sin miga).
3. AZÚCARES: Elimine azúcar de mesa, miel, mermeladas de azúcar, pasteles y jugos (incluso naturales).
4. FRUTAS: Consuma la fruta entera (no en jugo) y evite las de alto índice glucémico (uva, higo, sandía en exceso). Portions: máximo 2-3 unidades al día.
5. ETIQUETADO: Prefiera alimentos con sellos "Bajo en azúcar" y revise que no tengan el sello "ALTO EN AZÚCAR".`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "nutri_reg_hta",
      title: "EDU: Régimen Hiposódico (Corazón Sano)",
      category: "indication",
      roles: ["NUTRICIONISTA", "MEDICO", "ENFERMERA"],
      tags: ["Nutrición", "HTA"],
      content: `RECOMENDACIONES PARA REDUCIR EL SODIO (SAL):
1. ELIMINACIÓN: Retire el salero de la mesa.
2. PRODUCTOS PROHIBIDOS: Evite caldos en cubos, sopas sobre, embutidos (vienesas, paté), conservas y snacks salados.
3. CONDIMENTACIÓN ALQUIMISTA: Use hierbas naturales (perejil, albahaca), especias (pimienta, comino) y limón para realzar el sabor.
4. PAN: El pan en Chile es alto en sodio. Limite a 1 unidad diaria (priorice Marraqueta).
5. SELLOS: Elija SIEMPRE productos sin sello "ALTO EN SODIO".`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "nutri_reg_hepatico",
      title: "EDU: Régimen para Daño Hepático Crónico",
      category: "indication",
      roles: ["NUTRICIONISTA", "MEDICO"],
      tags: ["Nutrición", "Hepatopatía"],
      content: `INDICACIONES PARA PACIENTES CON CIRROSIS:
1. NO AYUNO: Nunca pase más de 4 horas sin comer. El ayuno prolongado daña su hígado.
2. COLACIÓN NOCTURNA: Es obligatorio consumir una colación antes de dormir (ej: yogurt o 1/2 pan con queso fresco).
3. PROTEÍNAS: Consuma carnes blancas y lácteos descremados en la cantidad exacta indicada.
4. SODIO: Restricción absoluta de sal si presenta hinchazón (edema) o líquido en el abdomen (ascitis).
5. ALCOHOL: Prohibición absoluta de consumo de alcohol.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "nutri_reg_renal",
      title: "EDU: Régimen Renal y Técnica de Remojo",
      category: "indication",
      roles: ["NUTRICIONISTA", "MEDICO"],
      tags: ["Nutrición", "Renal"],
      content: `ALIMENTACIÓN PARA CUIDAR SUS RIÑONES (Pre-diálisis):
1. TÉCNICA DE REMOJO: Para reducir el Potasio, las legumbres y papas deben dejarse en remojo 12-24 horas, cambiando el agua al menos 2 veces y luego cocer en agua nueva (botar el agua de cocción).
2. PROTEÍNAS: Limite el consumo de carnes rojas y blancas a la porción de la palma de su mano.
3. FÓSFORO: Evite bebidas cola, productos integrales, frutos secos y lácteos en exceso.
4. LÍQUIDOS: Si tiene hinchazón, beba solo el volumen de líquido que su médico le indicó.
5. CONDIMENTOS: Prohibido usar "Sustitutos de sal" (como Biosal) ya que contienen potasio dañino para su riñón.`,
      userId: "system",
      createdAt: new Date().toISOString()
   },
   {
      id: "edu_inhalacion",
      title: "EDU: Técnica Correcta de Inhalación (Chile APS)",
      category: "indication",
      roles: ["ENFERMERA", "KINESIOLOGO", "MEDICO", "TENS"],
      tags: ["Educación", "Respiratorio", "SOCHIPE"],
      content: `PASOS PARA USO DE AEROCÁMARA Y PUFF:
1. PREPARACIÓN: Saque la tapa, agite el inhalador por 5 segundos y conéctelo a la aerocámara en posición vertical (forma de L).
2. POSICIÓN: Siéntese derecho con la cabeza levemente hacia atrás. Bote todo el aire de sus pulmones.
3. SELLADO: Coloque la boquilla en su boca (u use mascarilla cubriendo nariz y boca sin fugas).
4. DISPARO: Presione el inhalador UNA SOLA VEZ para liberar una dosis.
5. RESPIRACIÓN: Respire lenta y profundamente. Mantenga el aire 10 segundos (o respire 10 veces normalmente dentro de la aerocámara si es niño).
6. ESPERA: Si necesita otra dosis, espere 1 minuto y repita todo el proceso.
IMPORTANTE: Si usa corticoides (como Fluticasona), ENJUAGUE su boca con agua después de terminar.`,
      userId: "system",
      createdAt: new Date().toISOString()
   }
];
