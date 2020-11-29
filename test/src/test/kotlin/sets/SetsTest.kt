package sets

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

class SetsTest : StringSpec({
    "Boolean" {
        (Boolean.True is Boolean) shouldBe true
        (Boolean.False is Boolean) shouldBe true
    }

    "BinaryOp" {
        (BinaryOp.Equal is BinaryOp) shouldBe true
        (BinaryOp.NotEqual is BinaryOp) shouldBe true
        (BinaryOp.LessEqual is BinaryOp) shouldBe true
        (BinaryOp.LessThan is BinaryOp) shouldBe true
        (BinaryOp.GreaterEqual is BinaryOp) shouldBe true
        (BinaryOp.GreaterThan is BinaryOp) shouldBe true
    }
})