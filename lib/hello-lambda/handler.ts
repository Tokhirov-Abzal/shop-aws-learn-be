// Filename: handler.ts
export async function main(event: any) {
  return {
    message: `Success with message ${event.message}`,
  };
}
