package sets

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

class SetsTest : StringSpec({
    "Boolean" {
        Boolean.True.yaml() shouldBe "True"
        Boolean.False.yaml() shouldBe "False"
    }

    "BinaryOp" {
        BinaryOp.Equal.yaml() shouldBe "Equal"
        BinaryOp.NotEqual.yaml() shouldBe "NotEqual"
        BinaryOp.LessEqual.yaml() shouldBe "LessEqual"
        BinaryOp.LessThan.yaml() shouldBe "LessThan"
        BinaryOp.GreaterEqual.yaml() shouldBe "GreaterEqual"
        BinaryOp.GreaterThan.yaml() shouldBe "GreaterThan"
    }
})