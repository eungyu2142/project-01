const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReviewSummaryRequest {
  hospitalName?: string
  reviews?: Array<{
    animalType?: string
    species?: string
    diagnosis?: string
    cost?: number | null
    date?: string
    medicine?: string
    tags?: string[]
    customTags?: string[]
    body?: string
    rating?: number
  }>
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getOutputText(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const response = payload as {
    output_text?: string
    output?: Array<{
      type?: string
      content?: Array<{ type?: string; text?: string }>
    }>
  }

  if (typeof response.output_text === 'string') {
    return response.output_text
  }

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? '')
      .join('') ?? ''
  )
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('OPENAI_SUMMARY_MODEL') ?? 'gpt-5.4-mini'

  if (!apiKey) {
    return jsonResponse(501, { error: 'OPENAI_API_KEY is not configured.' })
  }

  let body: ReviewSummaryRequest

  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' })
  }

  const hospitalName = body.hospitalName?.trim() || '이 병원'
  const reviews = Array.isArray(body.reviews) ? body.reviews.slice(0, 20) : []

  if (reviews.length === 0) {
    return jsonResponse(400, { error: '요약할 리뷰가 없어요.' })
  }

  const compactReviews = reviews.map((review) => ({
    animalType: review.animalType,
    species: review.species,
    diagnosis: review.diagnosis,
    cost: review.cost,
    date: review.date,
    medicine: review.medicine,
    tags: review.tags?.slice(0, 8) ?? [],
    customTags: review.customTags?.slice(0, 8) ?? [],
    body: review.body?.slice(0, 1200) ?? '',
    rating: review.rating,
  }))

  const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            '너는 특수동물 병원 리뷰를 보호자 관점에서 요약하는 한국어 UX 작성자야. 과장하지 말고 리뷰에 근거한 내용만 짧고 자연스럽게 정리해.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            hospitalName,
            task:
              '리뷰들을 분석해서 좋은 점, 아쉬운 점, 이용 팁을 각각 한 문장으로 요약해줘. 특수동물 보호자가 병원을 고르는 데 도움이 되게 써줘.',
            reviews: compactReviews,
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'hospital_review_summary',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              good: { type: 'string' },
              bad: { type: 'string' },
              tip: { type: 'string' },
            },
            required: ['good', 'bad', 'tip'],
          },
        },
      },
    }),
  })

  const responsePayload = await openAiResponse.json().catch(() => null)

  if (!openAiResponse.ok) {
    return jsonResponse(openAiResponse.status, {
      error: 'AI 요약을 생성하지 못했어요.',
      detail:
        responsePayload && typeof responsePayload === 'object' && 'error' in responsePayload
          ? responsePayload.error
          : responsePayload,
    })
  }

  try {
    const outputText = getOutputText(responsePayload)
    const summary = JSON.parse(outputText)

    return jsonResponse(200, { summary })
  } catch {
    return jsonResponse(502, { error: 'AI 요약 응답을 읽지 못했어요.' })
  }
})
